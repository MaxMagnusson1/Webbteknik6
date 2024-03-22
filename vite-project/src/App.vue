<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'; 

const quiz = ref([])
const quizCompleted = ref(false); //sätter att quizCompleted ska börja på false när användaren startar quizet
const currentQuestionIndex = ref(0);//sätter att currentQuestionIndex ska börja på 0. En reaktiv referens till värde 0, inte endast en variabel utan att om värdet ändras kommer komponenteten reagera på det och uppdatdera värdet
const userAnswers = ref({}); //sätter att userAnswers ska börja på en tom object
const score = ref(0);
const scoreBoardData = ref("Ingen har ännu kört denna"); //sätter att scoreBoardData till tom textsträng

let id; 

/**
 * Fetchquestions hämtar frågor från backenden och sätter dessa i quiz.value
 * Kontrollerar ifall det finns ett sesssion id, ifall det inte finns ett sessions id hämtar den ur från endpointen /questions och om det inte finns ett session id så hämtar den från /questFromDB. I else satsen sätts även sessions:id:t som skickas med från endpointen till att vara en del av url:n
 */
const fetchQuestions = async () => {
  try {
    let sessionID = new URLSearchParams(window.location.search).get('sessionID');
    if(sessionID){
       id = sessionID;

  const response = await fetch('/questFromDB', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionID: id })
  });

  if (response.ok) {
    const questions = await response.json();

    quiz.value = questions;

  }

    }
    else {
   
      const response = await fetch('/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
   
    });
     if (response.ok) {
      const questions = await response.json();
      id = questions.sessionID;

      const currentURL = new URL(window.location.href);
      currentURL.searchParams.append('sessionID', id);
      window.history.replaceState({}, '', currentURL.toString());
    
      quiz.value = questions.questions; 
 
     }
 } } catch (error) {
    console.error('Error fetching questions', error);
  }
};

/**
 * setAnswer sätter användarens svar i userAnswers objectet
 */

const setAnswer = (index, answer) => {
  userAnswers.value[index] = answer; 

};

/**
 * totScoreDB hämtar totala poängen från backenden endpointen vilket är databasen i detta fallet och sätter dessa i scoreBoardData.value 
 * Används lite olika metoder såsom data.map för att iterera igenom arrayen som man får tillbaka så att det skrivs ut som en textsträng. catchar även eventuella fel och skriver ut dessa i konsolen
 */
const totScoreDB = async () => {
  try {
    const response = await fetch('/gameFromDB', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sessionID: id }) 
    });


    const data = await response.json();

    const dataWithPoints = data.map(item => item + ' poäng!<br>'); 

    //dataWithPoints.forEach(item => ());

    scoreBoardData.value = dataWithPoints.join('\n');
    
  } catch (error) {
    console.error('Error:', error);
  }
};
/**
 * NextQuestion ökar indexet för nästa fråga och uppdaterar poängen samt ifall spelet är klar, dvs currentQuestionIndex är större eller lika med än quiz.length avslutas spelet, kallar på totscoredb för att visa highscoren. 
 * Skickar även data till backenden med fetch för att spara användarens poäng och användarnamn*/

const NextQuestion = async () => {
  currentQuestionIndex.value++; // ökar indexet för nästa fråga
  let value = 0;
  for (const questionIndex in userAnswers.value) {
    const selected = userAnswers.value[questionIndex];
    if (selected != null && quiz.value[questionIndex].options[selected] === quiz.value[questionIndex].correct_answer) {
      value++
    }
  }
  score.value = value; // Uppdatera poängen

  if (currentQuestionIndex.value >= quiz.value.length) {
    
     totScoreDB();
   
    quizCompleted.value = true;
   

    // Skicka data till backend
 const response = await fetch('/scoreboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        score: score.value,
        id: id,
        user: window.user
      })
    });

    if (!response.ok) {
      console.error('Error:', response.status, response.statusText);
    }
  }
}



/**
 * Använder onMounted för att köra fetchQuestions när sidan laddas
 */
window.onload = () =>{
  fetchQuestions();

}
</script>

<template>
 <main class="app"> <!--main som är en container för allt innnehåll-->
 


    <h1>Quiz App</h1>
    
    <section  class="quiz" v-if="!quizCompleted && quiz.length"> <!--Kontrollerar med en vue direktiv 'v-if' ifall denna del ska renderas ut eller inte. Den kollar om  quizCompleted är sann
                                                                      det vill säga om man är färdig med quizet, är false för det sätts till false i sin funktion. Kollar även om quiz.length existerar
                                                                        det vill säga om den är störra än 0. Om båda dessa uppfylls aktiveras quizet och annars kommer man in i else satsen.--> 
        <div class="quizInfo"> <!--Container för frågan och poängen-->
        
          <span class ="question">{{ quiz[currentQuestionIndex].question}}</span> <!--hämtar indexet på vilken fråga användaren är på från den reaktiva referensen och skriver ut tillhörande fråga-->
        <span class ="score">score {{ score }}/{{ quiz.length }}</span>  <!--skriver ut användarens poäng och hur många frågor det finns, ex 2/10-->


      </div>

      <div class="options" > <!--v-for tar option och index som paramterar, itererar alla alternativ som finns i arrayen som apiet retunerar vid namn option. Detta finns i quiz, sen används currentQuestionIndex som index för vilken fråga
                                användaren är på och kan sedan hämta ut korrekta alternativ från options. Värdet tilldelas parametern options och index dess index. Key används för att varje option element ett unikt index. Sedan läggs 4 klasser
                                  till till label. Klasserna tilldelas på olika villkor, option true kommer alltid läggas till då villkoret alltid är true för att anvädnaren alltid ska för alternativ. Om det korrekta svaret, som hämtas ut från apiet 
                                  är samma sak som index på det korrekta svaret och användarens svar är samma sak som index, dvs om användaren har valt rätt svar kommer klassen correkt att sättas till true och 'aktiveras'. Om index inte är samma sak som det korrekta 
                                svaret samt om användaren har valt detta index, dvs om användaren har fel, aktiveras klassen wrong. Disabled klassen aktivers om användaren svar inte är null, det vill säga om den svarat --> 
				<label
					v-for="(option, index) in quiz[currentQuestionIndex].options" 
          :key ="index"
          :class="{
            'option': true,
            'choosen': index !== quiz[currentQuestionIndex].correct_answer && userAnswers[currentQuestionIndex] === index,
         //   'disabled': userAnswers[currentQuestionIndex] !== null, 
          }">
<!--input används för att användaren ska kunna välja ett alternativ i form av radioknappar. Id ger varje kapp ett unikt id-sträng i form av frågan tillsammans med ett index Samma sak gäller för name. Value ger varje radioknapp korrekt index
  V-model är en tvåvägsbindning som finns i vue-bibloteket och möjliggör att ändringar i html även återspeglas i logiken och vise versa. v-model är kopplat direkt till radioknapparna vilket gör att en bindning mellan varje radioknapp och logiken 
  skapas. I detta fall skapas en binding mellan radioknapparna och indexet på användarens valdra svar. Disabled förhindrar användaren från att ändra sitt svar då det sätts till true om det inte är null, dvs när användaren svarat på en fråga. 
  @change fungerar som en händelselyssnare som lyssnar efter interaktion med radioknapparna och när en knapp väljs kommer setAnswer metoden att kallas på där index för frågan skickas med samt index för det valda alternativet. Sista raden renderar 
ut texten av svarsalternativen i ett span element. -->
          <input type="radio" 
          :id="'option' + index" 
          :name ="'question' + currentQuestionIndex"
          :value ="index"
          v-model ="userAnswers[currentQuestionIndex]"
          @change="setAnswer(currentQuestionIndex, index)" 
          :disabled="userAnswers[currentQuestionIndex] === null">
          <span>{{ option }}</span>

        </label>
      </div>
   <!--En knapp för att gå till nästa fråga skapas med en eventlyssnare som lyssnar efter interaktion med knappen och vid interaktion kallar på metoden nextQuestion. Disabled är true till en början då det är null, det vill säga när användaren inte har valt ett svarsalternativ och när den inte 
  längre är null, det vill säga när användaren tryckt på ett svars alternativ så aktiveras den knappen. Sedan körs en turner-operator som kontrollerar ifall nuvarande quiestionIndex, dvs frågan man är på är 1 mindre än totala längden av alla frågor, alltså om man är på sista frågan så ska knappens 
text ändras till avsluta och annars  nästa fråga om man inte är på sista frågan. -->
			<button 
				@click="NextQuestion" 
        :disabled="userAnswers[currentQuestionIndex] == null">
        {{ currentQuestionIndex === quiz.length - 1 ? 'Finish' : 'Next question' }}
			</button>


    </section >
<!--else delen av villkoret i början, kontrollerar om quizCompletet är true, isåfall skrivs det ut att man är klar tillsammans med sin poäng-->
<section v-else-if="quizCompleted">
    <h2>You have finished the quiz!</h2>
    <span v-html ="scoreBoardData"></span>
    <p>your score: {{ score }}/{{ quiz.length }}</p>
   <!-- <p>Your score: {{ score }}/{{ quiz.length }}</p>-->
</section>
    <!--ifall ingen av de andra villkoren uppfylls, vilket betyder att något är fel så skrivs en text att det laddas ut. S-->
<section v-else>
  <p>Loading...</p>
</section>

  </main>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Courier New', Courier, monospace;
}


body {
  background-color: blue;
  color: #fff;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}

h1 {
  font-size: 2rem;
  margin-bottom: 2rem;
}

.quiz{
  background-color: #382a4b;
  padding: 2rem;
  width: 100%;
  max-width: 640px;
  border-radius: 0.5rem;
}

.quizInfo{  
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.quizInfo .question {
  color: #8f8f8f;
  font-size: 1.5rem;
}

.quiz-info .score{
  color: #fff; 
  font-size : 1.5rem;
}

.options {
  margin-bottom: 1rem;
}

.option{
  display: block;
  padding: 1rem; 
  background-color: #271c36; 
  margin-bottom: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
}

.option:hover{
  background-color: #2d213f;
}


.option.choosen{
  background-color: blue;
}

.option:last-of-type{
  margin-bottom: 0;
}

.option.disabled{
  pointer-events: none;
  opacity: 0.5;
}
.option input{
  display: none;
} 

button{
  appearance: none;
  outline: none;
  border: none;
  cursor: none;

  padding: 0.5rem 1rem;
  background-color: #2cce7d;
  color: #2d213f;
  font-weight: 700; 
  text-transform: uppercase;
  font-size: 1.25rem;
  border-radius: 0.5rem;
  cursor: pointer;

}

button:disabled{
  opacity: 0.5;

}

h2{
  font-size: 2rem;
  margin-bottom: 2rem;
}

p{
  font-size: 1.5rem;
  color: #8f8f8f;
  text-align: center;
}
</style>
