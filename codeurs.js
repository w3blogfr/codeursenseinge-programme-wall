function timeStringToFloat(time) {
  var hoursMinutes = time.split(/[.:]/);
  var hours = parseInt(hoursMinutes[0], 10);
  var minutes = hoursMinutes[1] ? parseInt(hoursMinutes[1], 10) : 0;
  return parseFloat(hours + minutes / 60);
}

function compareValues(key, order='asc') {
  return function(a, b) {
    if(!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
      // property doesn't exist on either object
      return 0;
    }

    const varA = (typeof a[key] === 'string') ?
      a[key].toUpperCase() : a[key];
    const varB = (typeof b[key] === 'string') ?
      b[key].toUpperCase() : b[key];

    let comparison = 0;
    if (varA > varB) {
      comparison = 1;
    } else if (varA < varB) {
      comparison = -1;
    }
    return (
      (order == 'desc') ? (comparison * -1) : comparison
    );
  };
}

var app = new Vue({
  el: '#app',
  data: {
    init:false,
	tweet: {
		text: "Bienvenue à Codeurs en seine",
		img: "https://www.codeursenseine.com/images/edition2019/kindarena.jpg"
	},
	slideIndex: 0,
	currentSlide:'none',
	maxSlide:3,
	timerTwitter: null,
	twitter:{
		tweets:[],
		lastId: null
	},
	sponsor: {
		sponsorUrlPrefix: 'https://github.com/CodeursEnSeine/CodeursEnSeine-site/raw/gh-pages/images/edition2019/sponsors/',
		sponsors: [],
		sponsorIndex: 0,
		currentSponsor: {},
	},
	program: {
		title: "En cours",
		talks:[],
		talksPerHour: [],
		nextTalkDelayMinutes:30,
		currentTalks:[],
		nextTalks:[],
		displayTalks:[],
		displayHour:0,
	},
	slideFunctions: ['showProgramme','showSponsor','showTwitter'],
	slideTimer: [20000,10000,15000],
	slideTimeout: null
  },
  methods: {
        moveNextSlide () {
			if(this.slideTimeout!=null) clearTimeout(this.slideTimeout);
			console.log('move next slide '+this.slideFunctions[this.slideIndex]);
			//Affiche le slide courant et programme le prochain selon la configuration choisit.
			this[this.slideFunctions[this.slideIndex]].call();
			var delay=this.slideTimer[this.slideIndex];
			this.slideIndex=(this.slideIndex+1<this.maxSlide) ? this.slideIndex+1: 0;
			this.slideTimeout=setTimeout(this.moveNextSlide,delay);
       },
	   loadResources(){
			var that=this;
			return Promise.all([
				this.loadSponsors(),
				this.loadProgramme(),
			]).then(() => { 
				this.init=true;
			});
	   },
	   refreshTwitter(){
		   var that=this;
		   TweetJs.ListTweetsOnUserTimeline("codeursenseine",function (data) {
		   if(data.length>0){			   
			   for(var i=0;i<data.length;i++){
					var tweet=data[i];
					if(tweet.id_str!=that.twitter.lastId){
						that.twitter.tweets.unshift(tweet.id_str);
					}else{
						break;
					}
			   }
			   that.twitter.lastId=data[0].id_str;
		   }
		});
	   },
	   loadSponsors(){
		   var that=this;
		   return axios.get('https://raw.githubusercontent.com/CodeursEnSeine/CodeursEnSeine-site/gh-pages/_data/edition2019/sponsors.yml')
			.then(function (data) {
			  that.sponsor.sponsors=jsyaml.load(data.data).map(function(obj){
					//On préload les images
					var img=new Image();
					img.src=that.sponsor.sponsorUrlPrefix+obj.logo;
					//On map l'object retourné
					return {
					 name: obj.name,
					 logo: that.sponsor.sponsorUrlPrefix+obj.logo
					}
			  });
			})
	   },
	   loadProgramme(){
		   console.log('loadProgramme');
			var that=this;
			return Promise.all([
				axios.get(`https://raw.githubusercontent.com/CodeursEnSeine/CodeursEnSeine-app/master/public/program.json`),
				axios.get(`https://blog.yoannfleury.dev/conference-hall-fetch/confs.json`)
			]).then(([program, confs]) => { 
			
				var confById=Object.fromEntries(
				   confs.data.talks.map(e => [e.id, e])
				)
				var speakerById=Object.fromEntries(
				   confs.data.speakers.map(e => [e.uid, e])
				)
			
				//Merge programm and conference-hall
				this.program.talks=program.data.talks.map((talkFromProgram) => {
					var newTalk=confById.hasOwnProperty(talkFromProgram.id) ? Object.assign({}, talkFromProgram, confById[talkFromProgram.id]) : talkFromProgram;
					if(newTalk.speakers){
						newTalk.speakers=newTalk.speakers.map(function(speaker){
							return (typeof speaker === 'string') ? speakerById[speaker] : speaker;
						});
					}
					return newTalk;
				});
				
				var talksPerHourMap={};
				this.program.talks.forEach(function(talk){
					var h=timeStringToFloat(talk.hour);
					if(talk.title!="Pause"){
						if(!talksPerHourMap[h]){
							talksPerHourMap[h]=[];
						}
						talksPerHourMap[h].push(talk);
					}
				});
				
				//Le résultat est une liste ordonnée des talks par heure
				this.program.talksPerHour=[];
				Object.entries(talksPerHourMap).sort(function(a, b) {
					return a[0] - b[0];
				}).forEach((element) => {
					var talksSorted=element[1];
					talksSorted.sort(compareValues('room'));
					this.program.talksPerHour.push({
						hour: element[0],
						talks: talksSorted
					
					})
				});
				
			});
	   },
	   showSponsor(){
			if(this.sponsor.sponsors.length>0){
				this.sponsor.sponsorIndex=(this.sponsor.sponsorIndex+1<this.sponsor.sponsors.length) ? this.sponsor.sponsorIndex+1: 0;
				this.sponsor.currentSponsor=this.sponsor.sponsors[this.sponsor.sponsorIndex];
			}
			this.currentSlide='sponsor';
	   },
	   showProgramme(){
			var date=new Date();
			var currentHour=date.getHours()+date.getMinutes()/60;
			//var currentHour=9.84; //Decomment for test
			
			var currentTalks=[];
			var nextTalks=[];
			
			this.program.talksPerHour.forEach((slot) => {
				if(currentHour<slot.hour && (currentHour+this.program.nextTalkDelayMinutes/60>slot.hour)){
					//Prochain talk dans n minutes
					nextTalks=slot.talks;
				}else if(currentHour>=slot.hour){
					//Talk en cours
					currentTalks=slot.talks;
				}else if(nextTalks.length==00 && currentTalks.length==0){
					//Premier talk de la journée
					nextTalks=slot.talks;
				}
			});
			this.program.displayTalks=currentTalks;
			this.program.displayHour=this.program.displayTalks.length > 0 ? this.program.displayTalks[0].hour : '';
			this.program.title = "En cours";
			
			if(nextTalks.length>0){
				setTimeout(() => {
					this.program.displayTalks=nextTalks;
					this.program.displayHour=this.program.displayTalks[0].hour;
					this.program.title = "A venir";
				},5000);
			}
			
			this.currentSlide='program';
	   },
	   showTwitter(){
			var that=this;
			if(that.twitter.tweets.length>0){
				document.getElementById('twitter-card').innerHTML = '';
				twttr.widgets.createTweet(
					  that.twitter.tweets[0],
					  document.getElementById('twitter-card'),
					  {
						lang:'fr',
						align:'center'
					  }
				).then(() => {
					this.currentSlide='twitter';
				});
				//On supprime le premier
				that.twitter.tweets.splice(0,1);
			}
	   }
   },
  created () {
	this.refreshTwitter();
    this.timerTwitter = setInterval(this.moveNextSlide, 60000);
	this.loadResources()
		.then(() => {
			this.moveNextSlide();
		});
	
	setInterval(this.loadProgramme, 600000);
  },
})