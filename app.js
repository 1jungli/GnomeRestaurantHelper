//This object is used to set the config for this app
var config={
	appName:"Gnome Restaurant Helper",
	description:"Tells you what ingredients you need for what recipes, as well as fastest routes to recipient of recipe.",
	appUrl:"/alt1/GnomeRestaurantHelper",//app startup url relative to current domain
	configUrl:"/alt1/GnomeRestaurantHelper/appconfig.json",//link to a json file which contains this object, this link uniquely identifies your app
	defaultWidth:300,//preferred sizes, can be overwritten by alt1
	defaultHeight:300,
	minWidth:200,
	minHeight:200,
	maxWidth:1000,
	maxHeight:1000,
	
	//used to signal alt1 that this app can handle certain requests like a player lookup when the user presses alt+1 over a player name.
	//{handlerName:"player",handlerUrl:"/myUrl/?player=%s",handlerScript:"setPlayer('%s');"}
	requestHandlers:[],
	
	//will open this app when you press alt1 while hovering over drop blue partyhat etc (up to 10 currently)
	activators: [],

	//a comma separate list of required permissions for this app to run
	permissions:"pixel,gamestate"
};

function pullDataThroughYQL(url,callback){
	var url = `https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20json%20where%20url%20%3D%20'${encodeURIComponent(url)}'&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys`;
	var xmlreq = new XMLHttpRequest();
	xmlreq.open("GET",url,true);
	if(typeof(callback)!="function") {
		console.error(`[${APP_ID}] no callback provided!`);
		return;
	}
	xmlreq.onload=function(){
		if(xmlreq.readyState==4) {
			recipeText = xmlreq.responseText;
			recipeDoc = JSON.parse(xmlreq.responseText);
			callback(true,recipeDoc.query.results);
		}
	}
	xmlreq.onerror=function(){
		callback(false);
	}
	xmlreq.send();
}

const GE_SPRITE_PREFIX = "http://services.runescape.com/m=itemdb_rs/obj_sprite.gif?id=";

const APP_ID = "GnomeRestaurantHelper";
const STORAGE_ID = APP_ID+"Storage";

//reference the appconfig.json file as config, this file can also be referenced in an alt1 link in any browser
//clicking this link in any browser will start alt1 and show an add app dialog
//<a href="alt1:addapp:http://runeapps.org/apps/alt1/example/appconfig.json">Add example app</a>
//only supported in alt1 1.1+
if(window.alt1 && alt1.versionint>1001000){alt1.identifyAppUrl("appconfig.json");}

function elid(id){return document.getElementById(id);}

const DEFAULT_OPTIONS = {
	lastTab:"recipe",
	player:null,
	lastRecipe:null,
	lastGnome:null,
	questEJ:false,
	questTGV:false,
	questTGT:false,
	questOSF:false,
	questMM:false,
	questFC:false,
	questTR:false,
	questTGD:false,
	questFT2:false,
	questFT3:false,
	questPC:false,
	questWT:false,
	questLS:false,
	questTMF:false,
	questTFT:false,
	questER:false,
	questTGW:false,
	tasksDesert:false,
	tasksArdy:false
};

var options = DEFAULT_OPTIONS;

const skillList = [
	"Attack",			"Defence",		"Strength",
	"Constitution",		"Ranged",		"Prayer",
	"Magic",			"Cooking",		"Woodcutting",
	"Fletching",		"Fishing",		"Firemaking",
	"Crafting",			"Smithing",		"Mining",
	"Herblore",			"Agility",		"Thieving",
	"Slayer",			"Farming",		"Runecrafting",
	"Hunter",			"Consruction",	"Summoning",
	"Dungeoneering",	"Divination",	"Invention"
];


var skillsPulled = false;
var playerSkills = new Uint8Array(27);

function pullPlayerSkills() {
	if(options.player===null) return;
	skillsPulled=false;
	pullDataThroughYQL(`https://apps.runescape.com/runemetrics/profile/profile?user=${options.player}&activities=0`,(success,data)=>{
		lastdata=data;
		if(data && data.json) data=data.json;
		if(!success || !data || data.error) {
			if(data && data.error) {
				console.error(`[${APP_ID}] An error occurred while retrieving the player levels: ${data.error}`);
			}
			for(var i=0;i<27;i++) {
				playerSkills[i]=120;
			}
			skillsPulled=true;
			return;
		}
		var skillvalues = data.skillvalues;
		for(var i=0;i<27;i++) {
			playerSkills[i]=skillvalues[i].level;
		}
		skillsPulled=true;
		console.info(`[${APP_ID}] Successfully pulled levels for '${options.player}'!`);
	});
}

function getPlayerSkill(skill) {
	if(!skillsPulled) {
		pullPlayerSkills();
		return 0;
	}
	var ind = skillList.indexOf(skill);
	if(ind<0) return 0;
	return playerSkills[ind];
}

function processRequirements(txt) {
	var bool = true;
	var spl = txt.split(",");
	for(var i=0,split,j,v;i<spl.length;i++) {
		split = spl[i];
		j = split.indexOf(">");
		if(j>0) {
			if((split.substr(0,j)).substr(0,5)=="skill") {
				v=getPlayerSkill(split.substr(0,j).substr(5));
			} else {
				v=-1; // Only skills should be quantified.
			}
			bool = bool && v>parseInt(split.substr(j+1));
		} else
		if(options[split]!==undefined) {
			bool = bool && options[split];
		}
		if(!bool) return false;
	}
	return bool;
}

function _changeTab() {
	var i,els;
	els = document.getElementsByClassName("tabcontent");
	for(i=0;i<els.length;i++) {
		els[i].style.display=(els[i].getAttribute("name")==options.lastTab?"inline-block":"none");
	}
	els = document.getElementsByClassName("contenttab");
	for(i=0;i<els.length;i++) {
		try{els[i].classList.remove("activetab");}catch(e){}
		if(els[i].getAttribute("name")==options.lastTab) {
			els[i].classList.add("activetab");
		}
	}
}

function changeTab(event) {
	lastEvent=event;
	var nextTab = event.target.parentNode.getAttribute("name");
	if(options.lastTab==nextTab) {
		return;
	}
	options.lastTab=nextTab;
	_changeTab();
	saveOptions();
}

/*
 * Ready Status
 */

var recipesReady = false;
var itemsReady = false
var peopleReady = true;

function isReady() {
	return recipesReady && itemsReady && peopleReady && ge_price_queue.length<1;
}

/*
 * Recipe Data Preparation
 */

var recipes = {};
var recipeDoc = null;

const TYPE_NAMES = {
	drink:"Gnome Drinks",
	"food-crunchy":"Gnome Foods, Crunchies",
	"food-bowl":"Gnome Foods, Bowls",
	"food-batta":"Gnome Foods, Batta",
};

function processRecipes(recipeDoc) {
	if(recipesReady) {
		console.log("Items already processed!");
		return;
	}

	recipes = {};
	var lastType = "";
	var recipeEls = recipeDoc.getElementsByTagName("recipe");
	var i,el,id,sel,j,rI,ingredEls,ingred,k,dat;
	for(i=0;i<recipeEls.length;i++) {
		el = recipeEls[i];
		if(!(el instanceof Element)) continue;
		id = el.getAttribute("descriptor");
		if(typeof(id)=="string") {
			recipes[id]={};
			recipes[id].id = id;
			sel = el.getElementsByTagName("name")[0];
			recipes[id].name = sel instanceof Element?sel.innerHTML:"-missing-";
			sel = el.getElementsByTagName("type")[0];
			recipes[id].type = sel instanceof Element?sel.innerHTML:lastType;
			sel = el.getElementsByTagName("stage");
			recipes[id].stages = [];
			for(j=0;j<sel.length;j++) {
				ingredEls = sel[j].getElementsByTagName("ingredient")
				rI=recipes[id].stages.length;
				recipes[id].stages[rI] = {ingredients:[]};
				try{
					recipes[id].stages[rI].name = sel[j].getElementsByTagName("name")[0].innerHTML;
				} catch(e) {
					recipes[id].stages[rI].name = "-missing-";
				}
				if(ingredEls.length>0) {
					for(k=0;k<ingredEls.length;k++) {
						ingred=ingredEls[k];
						if(!(ingred instanceof Element)) continue;
						dat = {};
						dat.descriptor = ingred.getAttribute("descriptor");
						dat.count = ingred.getAttribute("count");
						if(items[dat.descriptor]===undefined) {
							console.error("Missing ingredient: '"+dat.name+"'");
							continue;
						}
						dat.meta = items[dat.descriptor];
						recipes[id].stages[rI].ingredients.push(dat);
					}
				}
			}
			sel = el.getElementsByTagName("notes")[0];
			recipes[id].notes = sel instanceof Element?sel.innerHTML:"";
			if(lastType!=recipes[id].type) {
				lastType=recipes[id].type
				var opt = new Option(TYPE_NAMES[recipes[id].type],recipes[id].type);
				opt.disabled=true;
				elid("selRecipe").appendChild(opt);
			}
			elid("selRecipe").appendChild(new Option("|- "+recipes[id].name,id));
		}
	}

	console.info("Recipes processed!");
	recipesReady=true;
	console.info("Attempting to load people!");
	updateRecipeInformation();
}

function loadRecipes() {
	var xmlreq = new XMLHttpRequest();
	xmlreq.open("GET","recipes.xml",true);
	xmlreq.onload=function(ev){
		if(xmlreq.readyState==4) {
			recipeDoc = xmlreq.responseXML;
			processRecipes(recipeDoc);
		}
	};
	xmlreq.send();
}

/*
 * Item Data Preparation
 */

var ge_prices = {};
var ge_price_queue = [];

function parseGEPrice(val) {
	val=val.replace(/,/g,"");
	var f = parseFloat(val);
	var i = parseInt(val);
	var suffix = val.substr(val.length-1).toLowerCase();
	if(suffix=="k") {
		return f*1000;
	} else if(suffix=="m") {
		return f*1000*1000
	} else if(suffix=="b") {
		return f*1000*1000*1000;
	}
	return i;
}

function retrieveGrandExchangePrice(id) {
	var item_id = id;
	pullDataThroughYQL(`http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item=${id}`,function(success,data){
		if(data===null) {
			setTimeout(queuePriceUpdate,500);
			return;
		}
		ge_data=data;
			if(ge_data.item && ge_data.item.current)
				ge_data=ge_data.item;
			ge_prices[ge_data.id]=parseGEPrice(ge_data.current.price);
			setTimeout(queuePriceUpdate,500);
	});
}

function queuePriceUpdate() {
	if(ge_price_queue.length<1) return;
	var item_name = ge_price_queue.pop();
	var item = items[item_name];
	if(typeof(item.item_id)=="string") {
		retrieveGrandExchangePrice(item.item_id);
	} else {
		queuePriceUpdate();
	}
}

function updatePrices() {
	for(var i in items) {
		ge_price_queue.push(i);
	}
	queuePriceUpdate();
}

var items = {};
var itemDoc = null;

function processItems(itemDoc) {
	if(itemsReady) {
		console.log("Items already processed!");
		return;
	}
	items = {};
	var itemEls = itemDoc.getElementsByTagName("item");
	for(var i=0,el,id,sel,j;i<itemEls.length;i++) {
		el = itemEls[i];
		if(!(el instanceof Element)) continue;
		id = el.getAttribute("descriptor");
		if(typeof(id)=="string") {
			items[id]={};
			items[id].item_id = el.getAttribute("id");
			sel = el.getElementsByTagName("name")[0];
			items[id].name = sel instanceof Element?sel.innerHTML:"-missing-";
			sel = el.getElementsByTagName("store");
			items[id].stores = [];
			for(j=0;j<sel.length;j++) {
				items[id].stores.push(sel[j] instanceof Element?{name:sel[j].getAttribute("name"),price:sel[j].getAttribute("price")}:{name:"unknown",price:"-"});
			}
			sel = el.getElementsByTagName("notes")[0];
			items[id].notes = sel instanceof Element?sel.innerHTML:"";
			items[id].img=GE_SPRITE_PREFIX+items[id].item_id;
		}
	}
	console.info("Items processed!");
	itemsReady=true;
	updatePrices();
	setInterval(updatePrices,10*60*60*1000)
	console.info("Attempting to load recipes!");
	loadRecipes();
}

function loadItems() {
	var xmlreq = new XMLHttpRequest();
	xmlreq.open("GET","items.xml",true);
	xmlreq.onload=function(ev){
		lastEvent=ev;
		if(xmlreq.readyState==4) {
			itemDoc = xmlreq.responseXML;
			processItems(itemDoc);
		}
	};
	xmlreq.send();
}

var reader = new DialogTextReader();

function checkDialog(capture) {
	if(reader.find(capture) && reader.read(capture)) {
		var txt = reader.readText(capture);
		if(txt[0].indexOf(" wants a ")>0) {
			var spl = txt[0].split(" wants a ");
			console.log("Recipe found! ",spl[0],spl[1]);
			elid("selRecipe").value = spl[1];
			currentPerson = spl[0];
		}
	}
}

var first = true;

function captureTick() {
	if(!isReady()) {
		return;
	}

	if(first) {
		first=false;
		updateRecipeInformation();
	}

	var capture = a1lib.bindfullrs();
	// Various checks
	if(capture) checkDialog(capture);
	// Update information

}

var currentPerson, currentRecipe;

function updateRecipeInformation() {
	var currentRecipe = options.lastRecipe = elid("selRecipe").value;
	console.log("Recipe changed to '"+currentRecipe+"'");
	console.log("Also known as "+(recipes[currentRecipe]?recipes[currentRecipe].name:"an unknown recipe."))
	var recipe = recipes[currentRecipe];
	var recipeEl = elid("tblRecipe");
	recipeEl.innerHTML="";
	if(!recipe) {
		console.error("Missing recipe: "+currentRecipe);
		return;
	}
	var tr,td,tb,i,stage,j,ingredient,k,store,odd=true;
	var totalPrice = 0;
	for(i=0;i<recipe.stages.length;i++) {
		tr = document.createElement("tr");
		tr.className=odd?"odd":"even";
		stage = recipe.stages[i];
		td = document.createElement("td");
		td.innerHTML = stage.name;
		td.colSpan=3;
		td.style.fontSize="1.2em";
		td.style.textAlign="center";
		tr.appendChild(td);
		recipeEl.appendChild(tr);
		if(stage.ingredients.length>0) {
			for(j=0;j<stage.ingredients.length;j++) {
				ingredient=stage.ingredients[j];
				tr = document.createElement("tr");
				tr.className=odd?"odd":"even";
				tr.appendChild(document.createElement("td"));
				td = document.createElement("td");
				td.style.valign="middle";
				td.innerHTML = "<span class=\"nistext\" style=\"float:left;\">"+ingredient.count+"x</span><img style=\"float:right;\" src=\""+ingredient.meta.img+"\" title=\""+ingredient.meta.name+"\" alt=\""+ingredient.meta.name+"\"/>";
				tr.appendChild(td);

				td = document.createElement("td");
				tb = document.createElement("table");
				tb.className="nistable";
				td.appendChild(tb);
				tr.appendChild(td);
				recipeEl.appendChild(tr);
				if(ingredient.meta.stores.length>0) {
					for(k=0;k<ingredient.meta.stores.length;k++) {
						store = ingredient.meta.stores[k];
						tr = document.createElement("tr");
						td = document.createElement("td");
						td.innerHTML = store.name;
						tr.appendChild(td);
						if(isNaN(parseInt(store.price))) {
							td.colSpan=2;
						} else {
							td = document.createElement("td");
							td.innerHTML = store.price+" gp";
							tr.appendChild(td);
							if(k===0) {
								totalPrice+=((ingredient.meta.item_id>2166 || ingredient.meta.item_id<2164) && ingredient.meta.item_id!=2169 && ingredient.meta.item_id!=2025)?ingredient.count*parseInt(store.price):0;
							}
						}
						tb.appendChild(tr);
					}
				}
				if(!isNaN(ge_prices[ingredient.meta.item_id]) && ge_prices[ingredient.meta.item_id]>0) {
					tr = document.createElement("tr");
					td = document.createElement("td");
					td.innerHTML = "Grand Exchange";
					tr.appendChild(td);
					td = document.createElement("td");
					td.innerHTML = ge_prices[ingredient.meta.item_id]+" gp";
					tr.appendChild(td);
					tb.appendChild(tr);
				}
			}
		} 
		odd=!odd;
	}
	tr = document.createElement("tr");
	td = document.createElement("td");
	td.style.textAlign="right";
	td.colSpan=2;
	td.innerHTML="Total Price";
	tr.appendChild(td);
	td = document.createElement("td");
	td.style.textAlign="right";
	td.innerHTML=totalPrice+" gp";
	tr.appendChild(td);
	recipeEl.appendChild(tr);
	saveOptions();
}

function saveOptions() {
	if(window.storageallowed) {
		localStorage.setItem(STORAGE_ID,JSON.stringify(options));
	}
}

function loadOptions() {
	if(window.storageallowed) {
		if(localStorage.getItem(STORAGE_ID)===null) {
			console.info(`[${APP_ID}] Loaded initial storage`);
			localStorage.setItem(STORAGE_ID,JSON.stringify(DEFAULT_OPTIONS));
			return;
		}
		var store = {};
		try {
			store = JSON.parse(localStorage.getItem(STORAGE_ID));
		} catch(e) {
			console.error(`[${APP_ID}] Failed to retrieve local storage! Resetting storage`);
			localStorage.setItem(`${STORAGE_ID}Backup_${new Date().toISOString()}`,localStorage.getItem(STORAGE_ID)); // Backup corrupted storage
			localStorage.setItem(STORAGE_ID,JSON.stringify(DEFAULT_OPTIONS));
			store = DEFAULT_OPTIONS;
			return;
		}
		for(var k in store) {
			if(options[k]!==store[k]) {
				options[k]=store[k];
			}
		}
		Array.from(document.getElementsByClassName("nischeckbox")).forEach((el)=>{
			var id = el.getAttribute("name");
			if(el.checked!==options[id] && options[id]!==undefined) {
				el.checked=options[id];
			}
		});
		Array.from(document.getElementsByClassName("nisinput")).forEach((el)=>{
			var id = el.getAttribute("name");
			if(el.value!==options[id] && options[id]!==undefined) {
				el.value=options[id];
			}
		});
		Array.from(document.getElementsByClassName("nisdropdown")).forEach((el)=>{
			var id = el.getAttribute("name");
			if(el.value!==options[id] && options[id]!==undefined) {
				el.value=options[id];
			}
		});
		pullPlayerSkills();
	} else {
		console.error(`[${APP_ID}] Storage is not allowed by this browser, thus all settings will reset after each reload.`);
	}
}

function updateOptions() {
	console.log("Options changed!");
	Array.from(document.getElementsByClassName("nischeckbox")).forEach((el)=>{
		var id = el.getAttribute("name");
		if(el.checked!==options[id] && options[id]!==undefined) {
			options[id]=el.checked;
		} else {
			if(el.checked!==options[id]) console.log(`[${APP_ID}] Wasn't able to update '${id}'!`);
		}
	});
	Array.from(document.getElementsByClassName("nisinput")).forEach((el)=>{
		var id = el.getAttribute("name");
		if(el.value!==options[id] && options[id]!==undefined) {
			if(id=="player") {
				pullPlayerSkills();
			}
			options[id]=el.value;
		} else {
			if(el.value!==options[id]) console.log(`[${APP_ID}] Wasn't able to update '${id}'!`);
		}
	});
	Array.from(document.getElementsByClassName("nisdropdown")).forEach((el)=>{
		var id = el.getAttribute("name");
		if(el.value!==options[id] && options[id]!==undefined) {
			options[id]=el.value;
		} else {
			if(el.value!==options[id]) console.log(`[${APP_ID}] Wasn't able to update '${id}'!`);
		}
	});
	saveOptions();
}

function updateSize(ev) {
	var width = window.innerWidth;
	var height = window.innerHeight;
	Array.from(document.getElementsByClassName("scroll")).forEach((el)=>{
		el.style.maxWidth=`${width}px`;
		el.style.maxHeight=`${height-48}px`;
	});
}

function start() {
	if(window.alt1) {
		console.log(`[${APP_ID}] Page loaded, alt1 recognised.`);
		for (var a in alt1.events) {
			alt1.events[a].push(function (e) { console.log(`[${APP_ID}] Event: ${JSON.stringify(e,null,'\t')}`); });
		}
		// Start loading items
		loadOptions();
		_changeTab();
		console.info(`[${APP_ID}] Attempting to load items!`);
		loadItems();
		// Shouldn't need frequent checks, so long as dialog stays open during a check, should be able to grab what is necessary. Also should ensure that every 400ms is slow enough for Alt1.
		setInterval(captureTick,Math.max(alt1.captureInterval,400));
		elid("selRecipe").addEventListener("change",updateRecipeInformation);
		elid("formOptions").addEventListener("change",updateOptions);
		window.addEventListener("resize",updateSize);
		updateSize();
	} else {
		console.log(`[${APP_ID}] Page loaded, alt1 not recognised.`);
	}
}