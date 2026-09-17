/**
 * Module that registers the outdoors functionality
 */
var Outside = {
	name: _("Outside"),
	
	_STORES_OFFSET: 0,
	_GATHER_DELAY: 60,
	_TRAPS_DELAY: 90,
	_POP_DELAY: [0.5, 3],
	_HUT_ROOM: 4,
	
	_INCOME: {
		'gatherer': { name: _('gatherer'), delay: 10, stores: { 'wood': 1 } },
		'lumber jack': { name: _('lumber jack'), delay: 10, stores: { 'wood': 10, 'cured meat': -1 } },
		'hunter': { name: _('hunter'), delay: 10, stores: { 'fur': 0.5, 'meat': 0.5 } },
		'trapper': { name: _('trapper'), delay: 10, stores: { 'meat': -1, 'bait': 1 } },
		'tanner': { name: _('tanner'), delay: 10, stores: { 'fur': -5, 'leather': 1 } },
		'charcutier': { name: _('charcutier'), delay: 10, stores: { 'meat': -5, 'wood': -5, 'cured meat': 1 } },
		'iron miner': { name: _('iron miner'), delay: 10, stores: { 'cured meat': -1, 'iron': 1 } },
		'coal miner': { name: _('coal miner'), delay: 10, stores: { 'cured meat': -1, 'coal': 1 } },
		'sulphur miner': { name: _('sulphur miner'), delay: 10, stores: { 'cured meat': -1, 'sulphur': 1 } },
		'steelworker': { name: _('steelworker'), delay: 10, stores: { 'iron': -1, 'coal': -1, 'steel': 1 } },
		'armourer': { name: _('armourer'), delay: 10, stores: { 'steel': -1, 'sulphur': -1, 'bullets': 1 } }
	},
	TrapDrops: [
		{ rollUnder: 0.5, name: 'fur', message: _('scraps of fur') },
		{ rollUnder: 0.75, name: 'meat', message: _('bits of meat') },
		{ rollUnder: 0.85, name: 'scales', message: _('strange scales') },
		{ rollUnder: 0.93, name: 'teeth', message: _('scattered teeth') },
		{ rollUnder: 0.995, name: 'cloth', message: _('tattered cloth') },
		{ rollUnder: 1.0, name: 'charm', message: _('a crudely made charm') }
	],
	
	init: function(options) {
		this.options = $.extend(this.options, options);
		if(Engine._debug) { this._GATHER_DELAY = 0; this._TRAPS_DELAY = 0; }
		this.tab = Header.addLocation(_("A Silent Forest"), "outside", Outside);
		this.panel = $('<div>').attr('id', "outsidePanel").addClass('location').appendTo('div#locationSlider');
		$.Dispatch('stateUpdate').subscribe(Outside.handleStateUpdates);
		if(typeof $SM.get('features.location.outside') == 'undefined') {
			$SM.set('features.location.outside', true);
			if(!$SM.get('game.buildings')) $SM.set('game.buildings', {});
			if(!$SM.get('game.population')) $SM.set('game.population', 0);
			if(!$SM.get('game.workers')) $SM.set('game.workers', {});
		}
		if(typeof $SM.get('game.workers["lumber jack"]') != 'number') $SM.set('game.workers["lumber jack"]', 0);
		this.updateVillage();
		Outside.updateWorkersView();
		Outside.updateVillageIncome();
		Engine.updateSlider();
		new Button.Button({ id: 'gatherButton', text: _("gather wood"), click: Outside.gatherWood, cooldown: Outside._GATHER_DELAY, width: '80px' }).appendTo('div#outsidePanel');
		Outside.updateTrapButton();
	},
	
	getMaxPopulation: function() {
		return Math.min($SM.get('game.buildings["hut"]', true) * Outside._HUT_ROOM, 200);
	},
	
	increasePopulation: function() {
		var space = Outside.getMaxPopulation() - $SM.get('game.population');
		if(space > 0) {
			var num = Math.floor(Math.random() * (space / 2) + space / 2);
			num = Math.min(num || 1, space);
			if(num == 1) Notifications.notify(null, _('a stranger arrives in the night'));
			else if(num < 5) Notifications.notify(null, _('a weathered family takes up in one of the huts.'));
			else if(num < 10) Notifications.notify(null, _('a small group arrives, all dust and bones.'));
			else if(num < 30) Notifications.notify(null, _('a convoy lurches in, equal parts worry and hope.'));
			else Notifications.notify(null, _("the town's booming. word does get around."));
			Engine.log('population increased by ' + num);
			$SM.add('game.population', num);
		}
		Outside.schedulePopIncrease();
	},
	
	killVillagers: function(num) {
		$SM.add('game.population', num * -1);
		if($SM.get('game.population') < 0) $SM.set('game.population', 0);
		var remaining = Outside.getNumGatherers();
		if(remaining < 0) {
			var gap = -remaining;
			for(var k in $SM.get('game.workers')) {
				var numWorkers = $SM.get('game.workers["'+k+'"]');
				if(numWorkers < gap) { gap -= numWorkers; $SM.set('game.workers["'+k+'"]', 0); }
				else { $SM.add('game.workers["'+k+'"]', gap * -1); break; }
			}
		}
	},
	
	destroyHuts: function(num, allowEmpty) {
		var dead = 0;
		for(var i = 0; i < num; i++) {
			var population = $SM.get('game.population', true);
			var rate = population / Outside._HUT_ROOM;
			var full = Math.floor(rate);
			var huts = allowEmpty ? $SM.get('game.buildings["hut"]', true) : Math.ceil(rate);
			if(!huts) break;
			var target = Math.floor(Math.random() * huts) + 1;
			var inhabitants = target <= full ? Outside._HUT_ROOM : (target == full + 1 ? population % Outside._HUT_ROOM : 0);
			$SM.set('game.buildings["hut"]', $SM.get('game.buildings["hut"]') - 1);
			if(inhabitants) { Outside.killVillagers(inhabitants); dead += inhabitants; }
		}
		return dead;
	},
	
	schedulePopIncrease: function() {
		var nextIncrease = Math.floor(Math.random() * (Outside._POP_DELAY[1] - Outside._POP_DELAY[0])) + Outside._POP_DELAY[0];
		Outside._popTimeout = Engine.setTimeout(Outside.increasePopulation, nextIncrease * 60 * 1000);
	},
	
	updateWorkersView: function() {
		var workers = $('div#workers');
		if(!workers.length && $SM.get('game.population') === 0) return;
		var needsAppend = false;
		if(workers.length === 0) { needsAppend = true; workers = $('<div>').attr('id', 'workers').css('opacity', 0); }
		var numGatherers = $SM.get('game.population');
		var gatherer = $('div#workers_row_gatherer', workers);
		for(var k in $SM.get('game.workers')) {
			var workerCount = $SM.get('game.workers["'+k+'"]', true);
			var row = $('div#workers_row_' + k.replace(' ', '-'), workers);
			if(row.length === 0) {
				row = Outside.makeWorkerRow(k, workerCount);
				row.insertBefore(gatherer.length ? gatherer : workers.children().first());
			} else $('div#' + row.attr('id') + ' > div.row_val > span', workers).text(workerCount);
			numGatherers -= workerCount;
			$('.dnBtn, .dnManyBtn', row).toggleClass('disabled', workerCount === 0);
		}
		if(gatherer.length === 0) { gatherer = Outside.makeWorkerRow('gatherer', numGatherers); gatherer.prependTo(workers); }
		else $('div#workers_row_gatherer > div.row_val > span', workers).text(numGatherers);
		$('.upBtn, .upManyBtn', '#workers').toggleClass('disabled', numGatherers === 0);
		if(needsAppend && workers.children().length > 0) workers.appendTo('#outsidePanel').animate({opacity:1}, 300, 'linear');
	},
	
	getNumGatherers: function() {
		var num = $SM.get('game.population');
		for(var k in $SM.get('game.workers')) num -= $SM.get('game.workers["'+k+'"]', true);
		return num;
	},
	
	makeWorkerRow: function(key, num) {
		var name = Outside._INCOME[key].name;
		var row = $('<div>').attr({ key: key, id: 'workers_row_' + key.replace(' ', '-') }).addClass('workerRow');
		$('<div>').addClass('row_key').text(name || key).appendTo(row);
		var val = $('<div>').addClass('row_val').appendTo(row);
		$('<span>').text(num).appendTo(val);
		if(key != 'gatherer') {
			$('<div>').addClass('upBtn').appendTo(val).click([1], Outside.increaseWorker);
			$('<div>').addClass('dnBtn').appendTo(val).click([1], Outside.decreaseWorker);
			$('<div>').addClass('upManyBtn').appendTo(val).click([10], Outside.increaseWorker);
			$('<div>').addClass('dnManyBtn').appendTo(val).click([10], Outside.decreaseWorker);
		}
		$('<div>').addClass('clear').appendTo(row);
		var tooltip = $('<div>').addClass('tooltip bottom right').appendTo(row);
		for(var s in Outside._INCOME[key].stores) $('<div>').addClass('storeRow').append($('<div>').addClass('row_key').text(_(s))).append($('<div>').addClass('row_val').text(Engine.getIncomeMsg(Outside._INCOME[key].stores[s], Outside._INCOME[key].delay))).appendTo(tooltip);
		return row;
	},
	
	increaseWorker: function(btn) {
		var worker = $(this).closest('.workerRow').attr('key');
		if(Outside.getNumGatherers() > 0) $SM.add('game.workers["'+worker+'"]', Math.min(Outside.getNumGatherers(), btn.data));
	},
	decreaseWorker: function(btn) {
		var worker = $(this).closest('.workerRow').attr('key');
		if($SM.get('game.workers["'+worker+'"]', true) > 0) $SM.add('game.workers["'+worker+'"]', -Math.min($SM.get('game.workers["'+worker+'"]', true), btn.data));
	},
	
	updateVillageRow: function(name, num, village) {
		var id = 'building_row_' + name.replace(' ', '-');
		var row = $('div#' + id, village);
		if(row.length === 0 && num > 0) { row = $('<div>').attr('id', id).addClass('storeRow').append($('<div>').addClass('row_key').text(_(name))).append($('<div>').addClass('row_val').text(num)).append($('<div>').addClass('clear')).appendTo(village); }
		else if(num > 0) $('div#' + id + ' > div.row_val', village).text(num);
		else if(num === 0) row.remove();
	},
	
	updateVillage: function(ignoreStores) {
		var village = $('div#village');
		var population = $('div#population');
		var needsAppend = false;
		if(village.length === 0) { needsAppend = true; village = $('<div>').attr('id', 'village').css('opacity', 0); population = $('<div>').attr('id', 'population').appendTo(village); }
		for(var k in $SM.get('game.buildings')) {
			if(k == 'trap') {
				var traps = Math.max(0, $SM.get('game.buildings["trap"]', true) - $SM.get('stores.bait', true));
				Outside.updateVillageRow(k, traps, village);
				Outside.updateVillageRow('baited trap', Math.min($SM.get('game.buildings["trap"]', true), $SM.get('stores.bait', true)), village);
			} else {
				if(Outside.checkWorker(k)) Outside.updateWorkersView();
				Outside.updateVillageRow(k, $SM.get('game.buildings["'+k+'"]', true), village);
			}
		}
		population.text(_('pop ') + $SM.get('game.population') + '/' + Outside.getMaxPopulation());
		village.attr('data-legend', $SM.get('game.buildings["hut"]', true) === 0 ? _('forest') : _('village'));
		if(needsAppend && village.children().length > 1) village.prependTo('#outsidePanel').animate({opacity:1}, 300, 'linear');
		if($SM.get('game.buildings["hut"]', true) > 0 && typeof Outside._popTimeout == 'undefined') Outside.schedulePopIncrease();
		Outside.setTitle();
		if(!ignoreStores && Engine.activeModule === Outside && village.children().length > 1) $('#storesContainer').css({top: village.height() + 26 + Outside._STORES_OFFSET + 'px'});
	},
	
	checkWorker: function(name) {
		var map = { 'lodge': ['hunter', 'trapper'], 'tannery': ['tanner'], 'smokehouse': ['charcutier'], 'iron mine': ['iron miner'], 'coal mine': ['coal miner'], 'sulphur mine': ['sulphur miner'], 'steelworks': ['steelworker'], 'armoury': ['armourer'] };
		var jobs = map[name], added = false;
		if(jobs) for(var i = 0; i < jobs.length; i++) if(typeof $SM.get('game.workers["'+jobs[i]+'"]') != 'number') { $SM.set('game.workers["'+jobs[i]+'"]', 0); added = true; }
		return added;
	},
	
	updateVillageIncome: function() {
		for(var worker in Outside._INCOME) {
			var income = Outside._INCOME[worker];
			var num = worker == 'gatherer' ? Outside.getNumGatherers() : $SM.get('game.workers["'+worker+'"]');
			if(typeof num != 'number') continue;
			if(num < 0) num = 0;
			var stores = {};
			for(var store in income.stores) stores[store] = income.stores[store] * num;
			$SM.setIncome(worker, { delay: income.delay, stores: stores });
		}
		Room.updateIncomeView();
	},
	
	updateTrapButton: function() {
		var btn = $('div#trapsButton');
		if($SM.get('game.buildings["trap"]', true) > 0) {
			if(btn.length === 0) new Button.Button({ id: 'trapsButton', text: _("check traps"), click: Outside.checkTraps, cooldown: Outside._TRAPS_DELAY, width: '80px' }).appendTo('div#outsidePanel');
			else Button.setDisabled(btn, false);
		} else if(btn.length > 0) Button.setDisabled(btn, true);
	},
	
	setTitle: function() {
		var huts = $SM.get('game.buildings["hut"]', true);
		var title = huts === 0 ? _("A Silent Forest") : huts == 1 ? _("A Lonely Hut") : huts <= 4 ? _("A Tiny Village") : huts <= 8 ? _("A Modest Village") : huts <= 14 ? _("A Large Village") : _("A Raucous Village");
		if(Engine.activeModule == this) document.title = title;
		$('#location_outside').text(title);
	},
	
	onArrival: function(transition_diff) {
		Outside.setTitle();
		if(!$SM.get('game.outside.seenForest')) { Notifications.notify(Outside, _("the sky is grey and the wind blows relentlessly")); $SM.set('game.outside.seenForest', true); }
		Outside.updateTrapButton();
		Outside.updateVillage(true);
		Engine.moveStoresView($('#village'), transition_diff);
		var huts = $SM.get('game.buildings["hut"]', true);
		var music = huts === 0 ? AudioLibrary.MUSIC_SILENT_FOREST : huts == 1 ? AudioLibrary.MUSIC_LONELY_HUT : huts <= 4 ? AudioLibrary.MUSIC_TINY_VILLAGE : huts <= 8 ? AudioLibrary.MUSIC_MODEST_VILLAGE : huts <= 14 ? AudioLibrary.MUSIC_LARGE_VILLAGE : AudioLibrary.MUSIC_RAUCOUS_VILLAGE;
		AudioEngine.playBackgroundMusic(music);
	},
	
	gatherWood: function() {
		Notifications.notify(Outside, _("dry brush and dead branches litter the forest floor"));
		$SM.add('stores.wood', $SM.get('game.buildings["cart"]', true) > 0 ? 50 : 10);
		AudioEngine.playSound(AudioLibrary.GATHER_WOOD);
	},
	
	checkTraps: function(silent) {
		var drops = {}, msg = [], traps = $SM.get('game.buildings["trap"]', true), bait = $SM.get('stores.bait', true);
		var numDrops = traps + Math.min(bait, traps);
		for(var i = 0; i < numDrops; i++) for(var j in Outside.TrapDrops) if(Math.random() < Outside.TrapDrops[j].rollUnder) { var drop = Outside.TrapDrops[j]; drops[drop.name] = (drops[drop.name] || 0) + 1; if(msg.indexOf(drop.message) < 0) msg.push(drop.message); break; }
		drops.bait = -Math.min(bait, traps);
		if(!silent) Notifications.notify(Outside, _('the traps contain ') + msg.join(', '));
		$SM.addM('stores', drops);
		if(!silent) AudioEngine.playSound(AudioLibrary.CHECK_TRAPS);
	},
	
	handleStateUpdates: function(e) {
		if(e.category == 'stores') Outside.updateVillage();
		else if(e.stateName.indexOf('game.workers') === 0 || e.stateName.indexOf('game.population') === 0) { Outside.updateVillage(); Outside.updateWorkersView(); Outside.updateVillageIncome(); }
	}
};
