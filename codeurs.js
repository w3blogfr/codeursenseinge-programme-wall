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

String.prototype.toCapital = function() {
	let str = this
	let splittedStr = str.split(" ") // returns an array
	let array = [] // creates a array that will be used as output
	let finalStr = "" // the output string
	splittedStr.forEach(function(e) { array.push(e[0].toUpperCase() + e.slice(1, e.length))})  
  
	finalStr = array.join(" ") // divide the array elements and join them separated by " "s
	
	return finalStr
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
	   loadSponsors(){
		   var that=this;
		   return axios.get('https://api.github.com/repos/w3blogfr/codeursenseinge-programme-wall/contents/sponsors')
			.then(function (response) {
				var sponsors=[];
				response.data.forEach(file => {
					var img=new Image();
					img.src=file.download_url;
					sponsors.push({
						name: file.name,
						logo: file.download_url
					})
				});
				that.sponsor.sponsors=sponsors;
			});
	   },
	   parseMdx(text){
		var values={};
		var content=null;
		var nbDashSeparator=0;
		var lines=text.split("\n");
		var i=0;

		// On match les clés simples
		Array.from(text.matchAll (/(\w{1,}): "?([^"\n]*)"?/gi))
			.forEach( m => {
				values[m[1]]=m[2];
			});
		// On match les liste
		Array.from(text.matchAll (/(\w{1,}):\n((?:  - (?:.*)\n)+)/gi))
			.forEach( m => {
				var multiValues=m[2].split("\n")
				.filter( line => line.indexOf('-')>0)
				.map(line => {
					return line.replace('  - ','');
				})
				values[m[1]]=multiValues;
			});

		return {
			values: values,
			content: content
		}
	   },
	   loadProgramme(){
		   console.log('loadProgramme');
			var that=this;

			return axios.get('https://api.github.com/repos/CodeursEnSeine/codeursenseine.com/contents/content/conferences')
				.then(function (response) {
					var downloadUrls = response.data.map(x => x.download_url);
					
					var axiosPromises=[];
					downloadUrls.forEach(element => {
						axiosPromises.push(axios.get(element));
					});
					var talks=[];
					return Promise.all(axiosPromises).then(responses => { 
						var id=1;
						responses
							.map(response => response.data)
							.map(data => {
								var mdx=that.parseMdx(data);
								var minutes=new Date(mdx.values['start']).getMinutes();
								if(minutes<10){
									minutes='0'+minutes;
								}

								var talk={
									id: id++,
									title: mdx.values['title'],
									type: mdx.values['type'],
									room: mdx.values['room'],
									speakers: mdx.values['speakers']!=null ? mdx.values['speakers'].map(t => { 
										return {'identifier': t, 'displayName': t.replace('-',' ').toCapital()}
									}) : [],
									hour: new Date(mdx.values['start']).getHours()+':'+minutes
								}
								talks.push(talk);
							});

							that.program.talks=talks;
							that.prepareTalkPerHour();
					})
				})
/*
			return Promise.all([
				axios.get(`https://api.github.com/repos/CodeursEnSeine/codeursenseine.com/contents/content/conferences`),
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
				
			});
			*/
	   },
	   prepareTalkPerHour(){
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
			console.log('currentHour : '+currentHour);
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
			
			document.getElementById('twitter-iframe').src='';
			document.getElementById('twitter-iframe').src='twitter.html';
			//that.currentSlide='twitter';
			setTimeout(function(){
				that.currentSlide='twitter';
			},4000);

			/*
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
			*/
	   }
   },
  created () {
    this.timerTwitter = setInterval(this.moveNextSlide, 60000);
	this.loadResources()
		.then(() => {
			this.moveNextSlide();
		});
	
	setInterval(this.loadProgramme, 600000);
  },
})