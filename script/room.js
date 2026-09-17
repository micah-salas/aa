/**
 * Module that registers the simple room functionality
 */
var Room = {
	// times in (minutes * seconds * milliseconds)
	_FIRE_COOL_DELAY: 5 * 60 * 1000, // time after a stoke before the fire cools
	_ROOM_WARM_DELAY: 30 * 1000, // time between room temperature updates
	_BUILDER_STATE_DELAY: 0.5 * 60 * 1000, // time between builder state updates
	_STOKE_COOLDOWN: 10, // cooldown to stoke the fire
	_NEED_WOOD_DELAY: 15 * 1000, // from when the stranger shows up, to when you need wood
	buttons: {},
	Craftables: {
		'trap': {
			name: _('trap'),
			button: null,
			maximum: 10,
			availableMsg: _('builder says she can make traps to catch any creatures might still be alive out there'),
			buildMsg: _('more traps to catch more creatures'),
			maxMsg: $("more traps won't help now"),
			type: 'building',
			cost: function () {
				var n = $SM.get('game.buildings["trap"]', true);
				return { 'wood': 10 + (n * 10) };
			},
			audio: AudioLibrary.BUILD_TRAP
		},
		'cart': {
			name: _('cart'), button: null, maximum: 1,
			availableMsg: _('builder says she can make a cart for carrying wood'),
			buildMsg: _('the rickety cart will carry more wood from the forest'), type: 'building',
			cost: function () { return { 'wood': 30 }; }, audio: AudioLibrary.BUILD_CART
		},
		'hut': {
			name: _('hut'), button: null,
			maximum: 50,
			availableMsg: _("builder says there are more wanderers. says they'll work, too."),
			buildMsg: _('builder puts up a hut, out in the forest. says word will get around.'),
			maxMsg: _('no more room for huts.'), type: 'building',
			cost: function () {
				var n = $SM.get('game.buildings["hut"]', true);
				return { 'wood': 100 + (n * 50) };
			}, audio: AudioLibrary.BUILD_HUT
		},
