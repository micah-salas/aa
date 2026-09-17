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
		'gatherer': {
			name: _('gatherer'),
			delay: 10,
			stores: {
				'wood': 1
			}
		},
		'lumber jack': {
			name: _('lumber jack'),
			delay: 10,
			stores: {
				'wood': 10,
				'cured meat': -1
			}
		},
		'hunter': {
			name: _('hunter'),
			delay: 10,
			stores: {
				'fur': 0.5,
				'meat': 0.5
			}
		},
		'trapper': {
			name: _('trapper'),
			delay: 10,
			stores: {
				'meat': -1,
				'bait': 1
			}
		},
		'tanner': {
			name: _('tanner'),
			delay: 10,
			stores: {
				'fur': -5,
				'leather': 1
			}
		},
		'charcutier': {
			name: _('charcutier'),
			delay: 10,
			stores: {
				'meat': -5,
				'wood': -5,
				'cured meat': 1
			}
		},
		'iron miner': {
			name: _('iron miner'),
			delay: 10,
			stores: {
				'cured meat': -1,
				'iron': 1
			}
		},
		'coal miner': {
			name: _('coal miner'),
			delay: 10,
			stores: {
				'cured meat': -1,
				'coal': 1
			}
		},
		'sulphur miner': {
			name: _('sulphur miner'),
			delay: 10,
			stores: {
				'cured meat': -1,
				'sulphur': 1
			}
		},
		'steelworker': {
			name: _('steelworker'),
			delay: 10,
			stores: {
				'iron': -1,
				'coal': -1,
				'steel': 1
			}
		},
		'armourer': {
			name: _('armourer'),
			delay: 10,
			stores: {
				'steel': -1,
				'sulphur': -1,
				'bullets': 1
			}
		}
	},
	TrapDrops: [
		{
			rollUnder: 0.5,
			name: 'fur',
			message: _('scraps of fur')
		},
		{
			rollUnder: 0.75,
			name: 'meat',
			message: _('bits of meat')
		},
		{
			rollUnder: 0.85,
			name: 'scales',
			message: _('strange scales')
		},
		{
			rollUnder: 0.93,
			name: 'teeth',
			message: _('scattered teeth')
		},
		{
			rollUnder: 0.995,
			name: 'cloth',
			message: _('tattered cloth')
		},
		{
			rollUnder: 1.0,
			name: 'charm',
			message: _('a crudely made charm')
		}
	],
	
	init: function(options) {
		this.options = $.extend(
			this.options,
			options
		);
		
		if(Engine._debug) {
			this._GATHER_DELAY = 0;
			this._TRAPS_DELAY = 0;
		}
		
		// Create the outside tab
		this.tab = Header.addLocation(_("A Silent Forest"), "outside", Outside);
		
		// Create the Outside panel
		this.panel = $('<div>').attr('id', "outsidePanel")
			.addClass('location')
			.appendTo('div#locationSlider');
		
		//subscribe to stateUpdates
		$.Dispatch('stateUpdate').subscribe(Outside.handleStateUpdates);
		
		if(typeof $SM.get('features.location.outside') == 'undefined') {
			$SM.set('features.location.outside', true);
			if(!$SM.get('game.buildings')) $SM.set('game.buildings', {});
			if(!$SM.get('game.population')) $SM.set('game.population', 0);
			if(!$SM.get('game.workers')) $SM.set('game.workers', {});
		}
		// Keep the new job available in existing saves as well as new games.
		if(typeof $SM.get('game.workers["lumber jack"]') != 'number') {
			$SM.set('game.workers["lumber jack"]', 0);
		}
		
		this.updateVillage();
		Outside.updateWorkersView();
		Outside.updateVillageIncome();
		
		Engine.updateSlider();
		
		// Create the gather button
		new Button.Button({
			id: 'gatherButton',
			text: _("gather wood"),
			click: Outside.gatherWood,
			cooldown: Outside._GATHER_DELAY,
			width: '80px'
		}).appendTo('div#outsidePanel');

		Outside.updateTrapButton();
	},
	
	getMaxPopulation: function() {
		return Math.min($SM.get('game.buildings["hut"]', true) * Outside._HUT_ROOM, 200);
	},
