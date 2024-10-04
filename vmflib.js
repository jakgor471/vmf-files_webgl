(function(global, factory){
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.vmfLib = {}));
})(this, (function(exports){
	"use strict";

	function isalphabetical(char){
		return char >= 'A' && char <= 'Z' || char >= 'a' && char <= 'z' || char == '_'
	}

	function isnumerical(char){
		return char >= '0' && char <= '9'
	}

	function isalphanumeric(char){
		return char >= '0' && char <= '9' || char >= 'A' && char <= 'Z' || char >= 'a' && char <= 'z' || char == '_'
	}

	/*======== VMF ========*/
	function initLexerVmf(vmfstring){
		const gettoken = (lexer)=>{
			if(!lexer._curtoken)
				lexer._curtoken = lexer._nextToken(lexer);
			return lexer._curtoken;
		}
		const consume = (lexer)=>{
			lexer._curtoken = lexer._nextToken(lexer);
		}
		const nexttoken = (lexer)=>{
			let token = null;

			while(!token && lexer.pos < lexer.vmfstr.length){
				if(isalphabetical(lexer.vmfstr.charAt(lexer.pos))){
					let start = lexer.pos++;
					while(isalphanumeric(lexer.vmfstr.charAt(lexer.pos))){
						++lexer.pos;
					}

					token = {
						value: lexer.vmfstr.slice(start, lexer.pos),
						type: 'id'
					}
				} else if(lexer.vmfstr.charAt(lexer.pos) == '"'){
					let start = ++lexer.pos;
					while(lexer.vmfstr.charAt(lexer.pos) != '"'){
						++lexer.pos;
					}
					token = {
						value: lexer.vmfstr.slice(start, lexer.pos),
						type: 'string'
					}
					++lexer.pos;
				} else if(lexer.vmfstr.charAt(lexer.pos) == '{' || lexer.vmfstr.charAt(lexer.pos) == '}'){
					token = {
						value: lexer.vmfstr.charAt(lexer.pos),
						type: 'special'
					}
					++lexer.pos;
				} else {
					if(lexer.vmfstr.charAt(lexer.pos) == '\n')
						++lexer.line;
					++lexer.pos;
				}
			}

			return token;
		}

		return {
			vmfstr: vmfstring,
			pos: 0,
			line: 1,
			_curtoken: null,
			_nextToken: nexttoken,
			getToken: gettoken,
			consume: consume
		}
	}

	function vmfSkip(lexer, flag){
		let level = 1;
		if(!flag){
			while(lexer.getToken(lexer) && lexer._curtoken.value != '{'){
				lexer.consume(lexer);
			}
			lexer.consume(lexer);
		}
		while(lexer.getToken(lexer) && level > 0){
			if(lexer._curtoken.value == '{')
				++level;
			else if(lexer._curtoken.value == '}')
				--level;
			lexer.consume(lexer);
		}
	}

	function vmfParseKeyValues(lexer){
		const kvmap = new Map();

		while(lexer.getToken(lexer) && lexer._curtoken.type == "string"){
			const k = lexer._curtoken.value;
			lexer.consume(lexer);
			if(!lexer.getToken(lexer) || lexer._curtoken.type != "string")
				throw new Error("Error at line " + lexer.line + ", malformed key-value pair!");
			const v = lexer._curtoken.value;
			kvmap.set(k, v);
			lexer.consume(lexer);
		}

		return kvmap;
	}

	function vmfParsePlane(lexer, str){
		const regex = /\(([-\d\.e]+)\s([-\d\.e]+)\s([-\d\.e]+)\)\s\(([-\d\.e]+)\s([-\d\.e]+)\s([-\d\.e]+)\)\s\(([-\d\.e]+)\s([-\d\.e]+)\s([-\d\.e]+)\)/;
		const matched = str.match(regex);
		const plane = {p1:[],p2:[],p3:[]};

		if(!matched || matched.length < 10)
			throw new Error("Error at line " + lexer.line + `, malformed side '${str}'!`);

		for(let i = 0; i < 3; ++i){
			plane.p1[i] = parseFloat(matched[1 + i]);
	        plane.p2[i] = parseFloat(matched[4 + i]);
	        plane.p3[i] = parseFloat(matched[7 + i]);

	        if(isNaN(plane.p1[i] + plane.p2[i] + plane.p3[i]))
	        	throw new Error("Error at line " + lexer.line + `, malformed side '${str}'!`);
		}

		return plane;
	}

	function vmfParseDispInfo(lexer){
		lexer.consume(lexer);
		lexer.consume(lexer);

		const kv = vmfParseKeyValues(lexer);
		const dispinfo = {power: parseInt(kv.get("power") || "4"), elevation: parseInt(kv.get("elevation") || "0"), normals:[], offsets:[],offset_normals:[],distances:[],alphas:[]};
		const posmatched = (kv.get("startposition")).match(/\[([\d\.e-]+)\s([\d\.e-]+)\s([\d\.e-]+)\]/);
		dispinfo.startPosition = [parseFloat(posmatched[1]), parseFloat(posmatched[2]), parseFloat(posmatched[3])];
		dispinfo.elevation = parseFloat(kv.get("elevation"));

		while(lexer.getToken(lexer) && lexer._curtoken.value != '}'){
			if(lexer._curtoken.value == "normals" || lexer._curtoken.value == "offsets" || lexer._curtoken.value == "offset_normals"){
				const target = lexer._curtoken.value;
				lexer.consume(lexer);
				lexer.consume(lexer);
				const kv1 = vmfParseKeyValues(lexer);
				lexer.consume(lexer);

				const data = [];
				for(let i = 0; i < 2**dispinfo.power + 1; ++i){
					const matched = Array.from(kv1.get("row"+i.toString()).matchAll(/[\de/.-]+/g));

					for(let j = 0; j < (2**dispinfo.power + 1) * 3; j += 3){
						data.push([parseFloat(matched[j][0]), parseFloat(matched[j + 1][0]), parseFloat(matched[j + 2][0])]);
					}
				}

				if(target == "normals")
					dispinfo.normals = data;
				else if(target == "offsets")
					dispinfo.offsets = data;
				else
					dispinfo.offset_normals = data;
			} else if(lexer._curtoken.value == "distances" || lexer._curtoken.value == "alphas"){
				const target = lexer._curtoken.value;
				lexer.consume(lexer);
				lexer.consume(lexer);
				const kv1 = vmfParseKeyValues(lexer);
				lexer.consume(lexer);

				const data = [];
				for(let i = 0; i < 2**dispinfo.power + 1; ++i){
					const matched = Array.from(kv1.get("row"+i.toString()).matchAll(/[\de/.-]+/g));

					for(let j = 0; j < 2**dispinfo.power + 1; ++j){
						data.push(parseFloat(matched[j][0]));
					}
				}

				if(target == "distances")
					dispinfo.distances = data;
				else
					dispinfo.alphas = data;
			}else {
				vmfSkip(lexer);
			}
		}

		lexer.consume(lexer);

		return dispinfo;
	}

	function vmfParseSolid(lexer){
		const solid = {id: -1, sides: [], displacement: false};

		lexer.consume(lexer);
		lexer.consume(lexer);
		lexer.getToken(lexer);

		if(lexer._curtoken.value != "id")
			throw new Error("Error at line " + lexer.line + `, 'id' expected, got '${lexer._curtoken.value}'`)
		lexer.consume(lexer);
		lexer.getToken(lexer);
		solid.id = parseInt(lexer._curtoken.value);
		lexer.consume(lexer);

		while(lexer.getToken(lexer) && lexer._curtoken.value != '}'){
			if(lexer._curtoken.type == "id" && lexer._curtoken.value == "side"){
				lexer.consume(lexer);
				lexer.consume(lexer);
				const kv = vmfParseKeyValues(lexer);

				const side = {id: parseInt(kv.get("id")), triangle: vmfParsePlane(lexer, kv.get("plane")), 
				material: (kv.get("material") || "tools/nodraw").toLowerCase(), smoothingGroups: parseInt(kv.get("smoothing_groups"))};

				if(lexer.getToken(lexer) && lexer._curtoken.type == "id"){
					if(lexer._curtoken.value == "dispinfo"){
						solid.displacement = true;
						side.displacement = true;
						side.dispInfo = vmfParseDispInfo(lexer);
					} else
						vmfSkip(lexer, false);
				}
				lexer.consume(lexer);
				solid.sides.push(side);
			} else {
				vmfSkip(lexer, false);
			}
		}
		lexer.consume(lexer);

		return solid;
	}

	function vmfParseClass(lexer){
		const vmfIgnore = new Set(["hidden", "editor", "cameras", "visgroups", "cordon", "group", "versioninfo", "viewsettings"]);
		const entitiesToExtract = new Set(["sky_camera", "env_fog_controller"]);
		let solids = [];
		let entities = [];
		lexer.getToken(lexer);

		if(lexer._curtoken.type != "id")
			throw new Error("Error at line " + lexer.line + `, identifier expected, got '${lexer._curtoken.value}'`)
		if(vmfIgnore.has(lexer._curtoken.value)){
			vmfSkip(lexer, false);
			return null;
		}

		if(lexer._curtoken.value == "entity"){
			lexer.consume(lexer);
			lexer.consume(lexer);

			const kv = vmfParseKeyValues(lexer);

			if(entitiesToExtract.has(kv.get("classname"))){
				const entity = {};
				entity.classname = kv.get("classname");
				const posmatched = (kv.get("origin")).match(/([\d\.e-]+)\s([\d\.e-]+)\s([\d\.e-]+)/);
				entity.origin = [parseFloat(posmatched[1]), parseFloat(posmatched[2]), parseFloat(posmatched[3])];

				for(const [key, value] of kv){
					if(!entity[key])
						entity[key] = value;
				}

				entities.push(entity);
			}
		} else{
			lexer.consume(lexer);
			lexer.consume(lexer);
		}

		while(lexer.getToken(lexer)){
			let token = lexer._curtoken;
			if(token.type == "id"){
				if(token.value == "solid"){
					const solid = vmfParseSolid(lexer);

					if(solid)
						solids.push(solid);
				} else{
					const extracted = vmfParseClass(lexer);

					if(extracted){
						solids = solids.concat(extracted.solids);
						entities = entities.concat(extracted.entities);
					}
				}
			} else
				lexer.consume(lexer);
		}

		return {solids: solids, entities: entities};
	}

	function vmfParse(vmfstring){
		const lexer = initLexerVmf(vmfstring);
		let solids = [];
		let entities = [];
		
		while(lexer.getToken(lexer)){
			const extracted = vmfParseClass(lexer);
			
			if(!extracted) continue;

			solids = solids.concat(extracted.solids);
			entities = entities.concat(extracted.entities);
		}

		return {solids: solids, entities: entities};
	}

	function flipVector(p){
        // X Y Z <=> X Z -Y, from Source's/Quake's coordinates to OpenGL
        const p2 = [p[0], p[2], -p[1]];

        return p2;
    }

    exports.flipVector = flipVector;
	exports.parseVmf = vmfParse;

	Object.defineProperty(exports, '__esModule', { value: true });
}))