/**
 * Alla importer av paket som krävs senare i koden
 */
import express  from "express";
import { OAuth2Client } from 'google-auth-library';
import Cors from "cors";
const authClient = new OAuth2Client(); 
import mysql from 'mysql2'; 
import session from "express-session";

/**
 * Konfigurera miljövariabler
 */
const app = express();  
const port = 3000;
app.use(Cors());
app.use(express.static('../../dist', {
    
    setHeaders: res => {
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade')
    }
}));

app.use(express.json())


/** 
 * Endpoint för att logga in med Google
 */
app.post('/login', (req, res) => {
    const credential = req.body.credential;
    verify(credential)
    .then(data => res.json(data))
    .catch(err => res.status(400).json(err));

});
/**
 * Funktion för att verifiera en Google token så att google kontoto faktikst finns och att det inte är en fejk token. Retunerar payloaden från token.
 */

async function verify(token) {
    const ticket = await authClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return payload;
}


/**
 * Används för att skapa en anslutning till databasen med hjälp av mysql2 och egenskaperna host, user, password och database samt en callback funktion som loggar ut om det inte går att ansluta till databasen.
 */
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '', 
    database: 'webbteknik6' 
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
});

/**
 * Funktion för att blanda om ordningen på svarsalternativen i en fråga som används för att slmupa ordningen på korrekt svar och felaktiga svar från api:anropet 
*/

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };


  /**  
   * Endpoint för att skicka in poäng och sessionID till databasen. Om användaren inte loggar in med google sätts deras user till "Anonym". Används för att inte skapa problem i databasen samt kunna rendera ut någonting i frontend.
   */
  app.post('/scoreboard', async (req, res) => {

    let {score, id, user} = req.body;
    if (user ==null || user == "" || user == undefined){
        user = "Anonym";
    }
    const insertScoreQuery = 'INSERT INTO game (score, session_id, user) VALUES (?, ?, ?)';
    const scoreValues = [score, id, user];

    connection.query(insertScoreQuery, scoreValues, (err, results, fields) => {
        if (err) {
            console.error('Failed to insert question into database:', err);
            return;
        }
    });
});



/**
 * Endpoint för att hämta ut frågorna från api:an och skicka in dem i databasen. Om sessionID inte finns skapas en ny sessionID och frågorna skickas in i databasen. Annars hämtas frågorna från databasen och skickas till frontend.
 * Hämtas endast frågor från api:an om sessionID inte finns, det vil säga om det är en ny session. Komponenterna decodeas sedan för att renderas korrekt i frontend samt metoden shufflearray används och sessoinsID skickas med till frontend
 * Skickar även in ID i databasen i en annan tabell vilket är det nygenrata sessionID:t som skapats. 
 */ 
  app.post('/questions', async (req, res) => {
    const sessionID = req.body.sessionID; //hämtar samma sessionID som sätts på frontend: 

    if (!sessionID) {
        const newSessionID = Math.random().toString(36); 
      
    try {
        const response = await fetch("https://opentdb.com/api.php?amount=10&category=9&difficulty=easy&type=multiple&encode=url3986");
        const data = await response.json();
        
        if (!data.results) {return}; 
        const questions = data.results.map((question, index) => ({
            ID: index,
            question: decodeURIComponent(question.question),
            options: shuffleArray(question.incorrect_answers.map(answer => decodeURIComponent(answer)).concat(decodeURIComponent(question.correct_answer))),
            correct_answer: decodeURIComponent(question.correct_answer),
            selected: 1,
           sessionID: newSessionID
        }));


    const insertSessionQuerySessionID = 'INSERT INTO session (ID) VALUES (?)';
    const sessionValue = newSessionID;

    connection.query(insertSessionQuerySessionID, sessionValue, (err, results, fields) => {
        if (err) {
            console.error('Failed to insert question into database:', err);
            return;
        }
    });   
    
  questions.forEach(question => {
    const {question: questionText, options, correct_answer} = question;
    
    const insertQuestionQuery = 'INSERT INTO question (question, options, correct_answer, session_id) VALUES (?, ?, ?, ?)';
    const questionValues = [questionText, JSON.stringify(options), correct_answer, sessionValue]; //här använs json.stringify för att konvertera options till en sträng så alla options alternativ kan lagras inom en kolumn i databasen.

    connection.query(insertQuestionQuery, questionValues, (err, results, fields) => {
        if (err) {
            console.error('Failed to insert question into database:', err);
            return;
        }

    });
});

res.json({ questions, sessionID: newSessionID });    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
}

});

/**
 * Endpoint för att hämta ut frågor och svar från databasen. Om sessionID finns hämtas frågorna från databasen och skickas till frontend, det vill säga om någon har fått en länk av någon. 
 * Hämtar ut frågorna med det specefika sessions id:t och skickar till frontend.
 * Formatterar även om options som ligger som en lång sträng så det blir egna objekt i arrayen.
 */ 
app.post('/questFromDB', async (req, res) => {
    const sessionID = req.body.sessionID;
    if(sessionID){
        const selectQuestionsQuery = 'SELECT * FROM question WHERE session_id = ?';
        connection.query(selectQuestionsQuery, sessionID, (err, questions)=> {
            if (err) {
                console.error('Failed to fetch questions from database:', err);
                return;

            }
            const formattedQuestions = questions.map(question => ({
                ...question,
                options: JSON.parse(question.options)
            }));

            res.json(formattedQuestions);
        })
    }

}); 

/**
 * Endpoint för att hämta ut highscore listan från databasen. Hämtar ut score och user från game tabellen, använder metodne map för att de ska renderas korrekt senare och skickar till frontend.
 */  
app.post('/gameFromDB', async (req, res) => {
    const sessionID = req.body.sessionID;
    if(sessionID){
        const selectGameQuery = 'SELECT score, user FROM game WHERE session_id = ?';
        connection.query(selectGameQuery, sessionID, (err, game)=> {
            if (err) {
                console.error('Failed to fetch game from database:', err);
                return;

            }
           // res.json(game);
           const scoresAndUsers = game.map(item => `${item.user}: ${item.score}`);
           res.json(scoresAndUsers);
        })
    }   
});

/**
    Vilken port som servern ska lyssna på. 
*/
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});