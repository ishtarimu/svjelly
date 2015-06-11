var SVGParser = function () {};
//var isPolygon = /polygon|rect/ig;
var isLine = /polyline|line|path/ig;
var lineTags = 'polyline, line, path';

SVGParser.prototype.parse = function ($world, $SVG)
{
	this.SVG = $SVG;
	this.viewBoxWidth = Number(this.SVG.getAttribute('viewBox').split(' ')[2]);
	this.viewBoxHeight = Number(this.SVG.getAttribute('viewBox').split(' ')[3]);
	this.ratio = $world.getWidth() / this.viewBoxWidth;
	this.world = $world;
	this.world.setHeight(this.viewBoxHeight * this.ratio);

	//temp
	var elementsQuery = '*:not(g):not(linearGradient):not(stop):not([id*="joint"]):not([id*="constraint"])';
	var elemRaws = this.SVG.querySelectorAll(elementsQuery);

	var i = 0;
	var rawGroupPairings = [];
	var elemsLength = elemRaws.length;

	for (i = 0; i < elemsLength; i += 1)
	{
		var rawElement = elemRaws[i];
		//if (rawElement.nodeType === 3) { continue; }
		var groupInfos = this.getGroupInfos(rawElement);
		console.log(groupInfos);
		var currGroup = $world.createGroup(groupInfos.type, groupInfos.ID);

		//var elements = rawElement;
		//this.parseElements(elements, currGroup);

		var element = this.parseElement(rawElement);
		var nodesToDraw = currGroup.structure.create(element);
		this.setGraphicInstructions(currGroup, rawElement, nodesToDraw, element);

		// var hasGroup;
		// for (var k = 0, length = rawGroupPairings.length; k < length; k += 1)
		// {
		// 	var curr = rawGroupPairings[k];
		// 	if (curr.group === currGroup)
		// 	{
		// 		hasGroup = true;
		// 		break;
		// 	}
		// }
		// if (!hasGroup) { rawGroupPairings.push({ group: currGroup, raw: rawElement.parentNode }); }
		rawGroupPairings.push({ group: currGroup, raw: rawElement.parentNode });
	}

	var pairingsLength = rawGroupPairings.length;
	for (i = 0; i < pairingsLength; i += 1)
	{
		var pairing = rawGroupPairings[i];
		// this.parseAnchors(pairing.raw, pairing.group);
		this.parseConstraints(pairing.raw, pairing.group);
		this.parseCustomJoints(pairing.raw, pairing.group);
	}

	this.world.addGroupsToWorld();
};

SVGParser.prototype.getGroupInfos = function ($rawGroup)
{
	var groupElement = !$rawGroup.id && $rawGroup.parentNode.tagName !== 'svg' ? $rawGroup.parentNode : $rawGroup;
	var type;
	var ID;
	var regex = /([a-z\d]+)\w*/igm;
	var first = regex.exec(groupElement.id);
	var second = regex.exec(groupElement.id);
	//if (first) { type = second ? second[1] : first[1]; }
	//var groupType = groupElement.id.match();
	//if (groupType) { return groupType[1] || groupType[0]; }
	//automatic for lines
	if (!first && (groupElement.querySelectorAll(lineTags).length > 0 || groupElement.tagName.search(isLine) > -1))
	{
		type = 'line';
	}
	type = first ? first[1] : undefined;
	ID = second ? second[1] : null;

	return { ID: ID, type: type };
};

SVGParser.prototype.parseConstraints = function ($rawGroup, $group)
{
	var children = $rawGroup.childNodes;//$rawGroup.querySelectorAll('[id*="constraint"]');

	for (var i = 0, childrenLength = children.length; i < childrenLength; i += 1)
	{
		if (children[i].nodeType === Node.TEXT_NODE || children[i].id.search(/constraint/i) < 0) { continue; }
		var currConstraint = children[i];
		var result = /constraint-([a-z\d]*)/ig.exec(currConstraint.id);

		var parentGroupID = result ? result[1] : undefined;
		var parentGroup = parentGroupID ? this.world.getGroupByID(parentGroupID) : undefined;
		var points = this.parseElement(currConstraint).points;
		this.world.constrainGroups($group, parentGroup, points);
	}
};

SVGParser.prototype.parseElements = function ($elements, $group)
{
	for (var i = 0, elementsLength = $elements.length; i < elementsLength; i += 1)
	{
		var rawElement = $elements[i];

		var element = this.parseElement(rawElement);

		var nodesToDraw = $group.structure.create(element);
		this.setGraphicInstructions($group, rawElement, nodesToDraw, element);
	}
};

SVGParser.prototype.parseElement = function ($rawElement)
{
	var tagName = $rawElement.tagName;

	switch (tagName)
	{
		case 'line':
			return this.parseLine($rawElement);
		case 'rect':
			return this.parseRect($rawElement);

		case 'polygon':
		case 'polyline':
			return this.parsePoly($rawElement);

		case 'path':
			return this.parsePath($rawElement);

		case 'circle':
			return this.parseCircle($rawElement);
	}
};

SVGParser.prototype.setGraphicInstructions = function ($group, $rawElement, $nodes)
{
	for (var i = 0, length = $nodes.length; i < length; i += 1)
	{
		var currNode = $nodes[i];
		currNode.drawing = {};
		$group.nodes.splice($group.nodes.indexOf(currNode), 1);
		$group.nodes.splice(i, 0, currNode);
		// console.log($group.nodes.indexOf(currNode));
		// debugger;
	}
	var startNode = $nodes[0];
	var endNode = $nodes[$nodes.length - 1];

	var fill = $rawElement.getAttribute('fill') || '#000000';
	var stroke = $rawElement.getAttribute('stroke') || 'none';
	var lineWidth = $rawElement.getAttribute('stroke-width');
	var opacity = $rawElement.getAttribute('opacity');
	startNode.drawing.fill = fill;//fill === undefined ? 'none' : fill;
	startNode.drawing.stroke = stroke;
	startNode.drawing.radius = $group.structureInfos.radius / this.ratio;
	startNode.drawing.lineWidth = lineWidth * this.ratio || 1 * this.ratio;//lineWidth === undefined ? 'none' : lineWidth * this.ratio;
	startNode.drawing.lineCap = $rawElement.getAttribute('stroke-linecap') || 'round';
	startNode.drawing.lineJoin = $rawElement.getAttribute('stroke-linejoin') || 'round';
	startNode.drawing.opacity = opacity ? opacity : undefined;
	startNode.drawing.closePath = $group.type !== 'line' && $group.structureInfos.radius === undefined;
	//startNode.gradient = { x1: startNode.x, y1: startNode.y, x2: endNode.x, y2: endNode.y };
	//console.log(startNode, startNode.gradient);
	// debugger;
	var gradientStroke = /url\(#(.*)\)/im.exec(stroke);
	if (gradientStroke)
	{
		var gradient = [];
		// console.log(gradientStroke[1]);
		var stops = this.SVG.querySelectorAll('#' + gradientStroke[1] + '>stop');
		// console.log(stops);
		for (var k = 0, stopLength = stops.length; k < stopLength; k += 1)
		{
			var currStop = stops[k];
			var offset = Number(currStop.getAttribute('offset'));
			var color = currStop.getAttribute('style').match(/#[0-9A-F]+/im)[0];
			gradient.push({ offset: offset, color: color });
			startNode.drawing.strokeGradient = gradient;
			startNode.drawing.stroke = 'none';
		}
	}
	else
	{
		startNode.drawing.strokeGradient = 'none';
	}

	startNode.endNode = endNode;
	// startNode.drawing.stroke = stroke;
	// console.log('new start node', startNode.oX, startNode.oY, 'stroke : ', startNode.drawing.stroke);
	// startNode.drawing.strokeWidth = $rawElement.getAttribute('stroke-width') * this.ratio;
	startNode.isStart = true;
};

SVGParser.prototype.parseCircle = function ($rawCircle)
{
	var xPos = this.getCoordX($rawCircle.getAttribute('cx'));
	var yPos = this.getCoordY($rawCircle.getAttribute('cy'));
	var radius = this.getCoordX($rawCircle.getAttribute('r'));
	return { type: $rawCircle.tagName, points: [[xPos, yPos]], radius: radius };
};

SVGParser.prototype.parseLine = function ($rawLine)
{
	var x1 = this.getCoordX($rawLine.getAttribute('x1'));
	var x2 = this.getCoordX($rawLine.getAttribute('x2'));
	var y1 = this.getCoordX($rawLine.getAttribute('y1'));
	var y2 = this.getCoordX($rawLine.getAttribute('y2'));
	var points = [];
	points.push([x1, y1]);
	points.push([x2, y2]);
	return { type: $rawLine.tagName, points: points };
};

SVGParser.prototype.parseRect = function ($rawRect)
{
	var x1 = $rawRect.getAttribute('x') ? this.getCoordX($rawRect.getAttribute('x')) : 0;
	var y1 = $rawRect.getAttribute('y') ? this.getCoordY($rawRect.getAttribute('y')) : 0;
	var x2 = x1 + this.getCoordX($rawRect.getAttribute('width'));
	var y2 = y1 + this.getCoordY($rawRect.getAttribute('height'));
	var points = [];
	points.push([x1, y1]);
	points.push([x1, y2]);
	points.push([x2, y2]);
	points.push([x2, y1]);

	return { type: $rawRect.tagName, points: points };
};

SVGParser.prototype.parsePoly = function ($rawPoly)
{
	var splits = $rawPoly.getAttribute('points').split(' ');
	var points = [];

	for (var i = 0, splitsLength = splits.length; i < splitsLength; i += 1)
	{
		var currSplit = splits[i];

		if (currSplit !== '')
		{
			var point = currSplit.split(',');
			var pointX = this.getCoordX(point[0]);
			var pointY = this.getCoordY(point[1]);
			var exists = false;
			for (var k = 0, otherCoordsArrayLength = points.length; k < otherCoordsArrayLength; k += 1)
			{
				var otherPoint = points[k];
				var otherX = otherPoint[0];
				var otherY = otherPoint[1];
				if (otherX === pointX && otherY === pointY)
				{
					exists = true;
				}
			}
			if (exists === false)
			{
				points.push([pointX, pointY]);
			}
		}
	}

	return { type: $rawPoly.tagName, points: points };
};

SVGParser.prototype.parsePath = function ($rawPath)
{
	var d = $rawPath.getAttribute('d');
	var pathReg = /([mlscvh])(-?[\d\.]*[,-]+[\d\.]*),?(-?[\d\.]*,?-?[\d\.]*),?(-?[\d\.]*,?-?[\d\.]*)/igm;
	var points = [];
	var lastCoordX = this.getCoordX(0);
	var lastCoordY = this.getCoordY(0);
	for (var array = pathReg.exec(d); array !== null; array = pathReg.exec(d))
	{
		var coordString;
		var numberCoordX;
		var numberCoordY;
		if (array[1] === 'v')
		{
			numberCoordX = lastCoordX;
			numberCoordY = lastCoordY + this.getCoordY(array[2]);
		}
		else if (array[1] === 'h')
		{
			numberCoordX = lastCoordX + this.getCoordY(array[2]);
			numberCoordY = lastCoordY;
		}
		else
		{
			if (array[4] !== '')
			{
				coordString = array[4];
			}
			else if (array[3] !== '')
			{
				coordString = array[3];
			}
			else
			{
				coordString = array[2];
			}
			var coordReg = /(-?\d+\.?\d*)/igm;
			var coords = coordString.match(coordReg);

			numberCoordX = lastCoordX + this.getCoordX(coords[0]);
			numberCoordY = lastCoordY + this.getCoordY(coords[1]);
		}
		//console.log(numberCoordX, numberCoordY);
		points.push([numberCoordX, numberCoordY]);

		lastCoordX = numberCoordX;
		lastCoordY = numberCoordY;
	}

	return { type: $rawPath.tagName, points: points };
};

SVGParser.prototype.round = function ($number)
{
	// var number = Number($number);
	// return Math.floor(number * 100) / 100;
	return $number;
	//return Math.floor(Number($number));
};

SVGParser.prototype.getCoordX = function ($coordSTR)
{
	var number = this.round($coordSTR);
	return number * this.ratio;
};

SVGParser.prototype.getCoordY = function ($coordSTR)
{
	var number = this.round($coordSTR);
	//number = this.viewBoxHeight - number;
	return number * this.ratio;
};

SVGParser.prototype.parseCustomJoints = function ($rawGroup, $group)
{
	var children = $rawGroup.childNodes;//$rawGroup.querySelectorAll('[id*="constraint"]');

	for (var i = 0, childrenLength = children.length; i < childrenLength; i += 1)
	{
		if (children[i].nodeType === Node.TEXT_NODE || children[i].id.search(/joint/i) < 0) { continue; }

		var currRawJoint = children[i];
		var p1x = this.getCoordX(currRawJoint.getAttribute('x1'));
		var p1y = this.getCoordY(currRawJoint.getAttribute('y1'));
		var p2x = this.getCoordX(currRawJoint.getAttribute('x2'));
		var p2y = this.getCoordY(currRawJoint.getAttribute('y2'));

		var n1 = $group.getNodeAtPoint(p1x, p1y) || $group.createNode(p1x, p1y);
		var n2 = $group.getNodeAtPoint(p2x, p2y) || $group.createNode(p2x, p2y);
		$group.createJoint(n1, n2);
	}
};

module.exports = SVGParser;

