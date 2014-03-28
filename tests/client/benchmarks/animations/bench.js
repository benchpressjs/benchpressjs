"use strict";
/*global templates*/

// Change N to change the number of drawn circles.

var N = 100;

(function() {
	var boxes = [];
	var template,
			grid;

	function tplsInit() {
		var n = N, count = 0;

		boxes = [];
		template = document.getElementById('templates.js-template').innerHTML,
			grid = document.getElementById('grid');

		while(n--) {
			count++;
			boxes.push({
				top: 0,
				left: 0,
				content: 0,
				count: 0,
				color: 0,
				number: count
			});
		}

		grid.innerHTML = templates.parse(template, {boxes: boxes});
	}

	function tplsAnimate() {
		window.timeout = setInterval(function() {
			for (var i = 0, l = boxes.length; i < l; i++) {
				var box = boxes[i];
				var count = box.count++;
				box.top = Math.sin(count / 10) * 10;
				box.left = Math.cos(count / 10) * 10;
				box.color = count % 255;
				box.content = count % 100;

				document.getElementById('box-' + box.number).parentNode.innerHTML = templates.parse('<div class="box" id="box-{boxes.number}" style="top: {boxes.top}px; left: {boxes.left}px; background: rgb(0,0,{boxes.color});">{boxes.content}</div>', {boxes: box});
			}
			
		}, 0);
	}

	window.runTpls = function() {
		window.reset();
		tplsInit();
		tplsAnimate();
	};

})();

    
window.timeout = null;
window.reset = function() {
	$('#grid').empty();
	clearTimeout(window.timeout);    
};
