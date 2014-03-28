"use strict";


// Change N to change the number of drawn circles.

var N = 100;
/*
// The Backbone implementation:
(function(){
	    
	var Box = Backbone.Model.extend({

	    defaults: {
	        top: 0,
	        left: 0,
	        color: 0,
	        content: 0
	    },
	    
	    initialize: function() {
	        this.count = 0;
	    },

	    tick: function() {
	        var count = this.count += 1;
	        this.set({
	            top: Math.sin(count / 10) * 10,
	            left: Math.cos(count / 10) * 10,
	            color: (count) % 255,
	            content: count % 100
	        });
	    }        

	});


	var BoxView = Backbone.View.extend({
	    
	    className: 'box-view',
	    
	    template: _.template($('#underscore-template').html()),
	   
	    initialize: function() {
	        this.model.bind('change', this.render, this);
	    },
	    
	    render: function() {
	        this.$el.html(this.template(this.model.attributes));
	        return this;
	    }
	    
	});

	var boxes;

	var backboneInit = function() {
	    boxes = _.map(_.range(N), function(i) {
	        var box = new Box({number: i});
	        var view = new BoxView({model: box});
	        $('#grid').append(view.render().el);
	        return box;
	    });
	};

	var backboneAnimate = function() {
	    for (var i = 0, l = boxes.length; i < l; i++) {
	      boxes[i].tick();   
	    }
	    window.timeout = _.defer(backboneAnimate);
	};

	window.runBackbone = function() {
	  reset();
	  backboneInit();
	  backboneAnimate();    
	};

})();
*/


// The Ember implementation:
(function(){
	    
	var Box = Ember.Object.extend({
	    
	    top: 0,
	    left: 0,
	    content: 0,
	    count: 0,
	    
	    tick: function() {
	        var count = this.get('count') + 1;
	        this.set('count', count);
	        this.set('top', Math.sin(count / 10) * 10);
	        this.set('left', Math.cos(count / 10) * 10);
	        this.set('color', count % 255);
	        this.set('content', count % 100);
	    },
	    
	    style: function() {
	        return 'top: ' + this.get('top') + 'px; left: ' +  this.get('left') +'px; background: rgb(0,0,' + this.get('color') + ');';
	    }.property('top', 'left', 'color')

	});
	    
	var BoxView = Ember.View.extend({
	    classNames: ['box-view'],
	    templateName: 'box'
	});
	    
	var boxes;

	var emberInit = function() {
	    boxes = _.map(_.range(N), function(i) {
	        var box = Box.create();
	        var view = BoxView.create({model: box});
	        view.appendTo('#grid');
	        box.set('number', i);
	        return box;
	    });
	};

	var emberAnimate = function() {
	    for (var i = 0, l = boxes.length; i < l; i++) {
	      boxes[i].tick();   
	    }
	    window.timeout = _.defer(emberAnimate);
	};

	window.runEmber = function() {
	  reset();
	  emberInit();
	  emberAnimate();    
	};      
    
})();


(function() {
	var boxes = [];
	var template,
			grid;

	function tplsInit() {
		boxes = [];
		template = document.getElementById('templates.js-template').innerHTML,
			grid = document.getElementById('grid');

		var n = N, count = 0;

		while (n--) {
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
	   reset();
	   tplsInit();
	   tplsAnimate();
	};

})();

    
window.timeout = null;
window.reset = function() {
  $('#grid').empty();
  clearTimeout(timeout);    
};
