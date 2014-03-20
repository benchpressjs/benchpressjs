"use strict";
/*global templates*/

function init() {
	var tpl = document.getElementById('tpl1'),
		obj = {
			username: "psychobunny",
			top: 1,
			package: {
				"name": "templates.js"
			},
			arr: [
				{
					"count": 190,
					"derp": 10
				},
				{
					"count": 190,
					"derp": 10
				},
				{
					"count": 190,
					"derp": 10
				}
			]
		};

	tpl.innerHTML = templates.parse(tpl.innerHTML, obj, true);
	obj.arr[1].count = 2;
	obj.arr[1].derp = 9;
	obj.arr[2].count = 5;
	obj.arr[2].derp = 4;
	obj.arr[1].count = 5;
	obj.username = "asd";
	obj.package.name = "test";

	delete obj.arr[2];
	console.log(obj.arr);

	/*setInterval(function() {
		obj.arr[0].count++;	
	}, 10);*/

}


window.onload = init;