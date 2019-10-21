function timeStringToFloat(time) {
  var hoursMinutes = time.split(/[.:]/);
  var hours = parseInt(hoursMinutes[0], 10);
  var minutes = hoursMinutes[1] ? parseInt(hoursMinutes[1], 10) : 0;
  return parseFloat(hours + minutes / 60);
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
		talks:[],
		talksPerHour: {},
		nextTalkDelayMinutes:10,
		currentTalks:[],
		nextTalks:[],
		displayTalks:[],
		displayHour:0,
	},
	slideFunctions: ['showProgramme','showSponsor','showTwitter'],
	slideTimer: [15000,10000,15000],
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
				
				var talksPerHour={};
				this.program.talks.forEach(function(talk){
					var h=timeStringToFloat(talk.hour);
					if(!talksPerHour[h]){
						talksPerHour[h]=[];
					}
					talksPerHour[h].push(talk);
				});
				this.program.talksPerHour=talksPerHour;
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
			
			var list=Object.entries(this.program.talksPerHour).sort(function(a, b) {
				return a[0] - b[0];
			});
			
			for (const [ hTalks, talks ] of list) {
				if(currentHour<hTalks && (currentHour+this.program.nextTalkDelayMinutes/60>hTalks)){
					//Prochain talk dans n minutes
					nextTalks=talks;
				}else if(currentHour>=hTalks){
					//Talk en cours
					currentTalks=talks;
				}else if(nextTalks.length==00 && currentTalks.length==0){
					//Premier talk de la journée
					nextTalks=talks;
				}
			}
			this.program.displayTalks=nextTalks.length>0 ? nextTalks : currentTalks;
			this.program.displayHour=this.program.displayTalks[0].hour;
			
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
  },
})