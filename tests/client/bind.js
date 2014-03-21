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
					"number": 10
				},
				{
					"count": 190,
					"number": 10
				},
				{
					"count": 190,
					"number": 10
				}
			]
		};

	tpl.innerHTML = templates.parse(tpl.innerHTML, obj, true);
	/*obj.arr[1].count = 2;
	obj.arr[1].number = 9;
	obj.arr[2].count = 5;
	obj.arr[2].number = 4;
	obj.arr[1].count = 5;
	obj.username = "asd";
	obj.package.name = "test";*/
	//obj.arr[2] = null;

	obj.arr.push({
		"count": 190,
		"number": 10
	});

	//delete obj.arr[2];
}


window.onload = init;