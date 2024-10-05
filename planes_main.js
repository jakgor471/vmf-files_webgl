"use strict";

function compileAnimFrame(gl, animFrame){
    const compiled = {draw: []};

    for(let i = 0; i < animFrame.length; ++i){
        if(animFrame[i].type == "w"){
            const data = new ArrayBuffer(8192);

            if(!animFrame[i].data || animFrame[i].data.length > 32) continue; //too big winding or no winding!

            let size = windingToBuffer(animFrame[i].data, data, 0);
            if(size < 1)
                continue
            let buff = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buff);
            gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data, 0, size), gl.DYNAMIC_DRAW);

            compiled.draw.push({type: "w", buffer: buff, elements: animFrame[i].data.length - 2});
        }

        if(animFrame[i].type == "p"){
            const data = new ArrayBuffer(512);

            const winding = baseWinding(animFrame[i].data, MAXMAPSIZE / 2);
            let size = windingToBuffer(winding, data, 0, [255, 255, 0, 100]);
            let buff = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buff);
            gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data, 0, size), gl.DYNAMIC_DRAW);

            compiled.draw.push({type: "p", buffer: buff, color: animFrame[i].color || [1, 0, 0, 1]});
        }

        if(animFrame[i].type == "pt"){
            compiled.draw.push({type: "pt", data: animFrame[i].data, color: animFrame[i].color || [1, 0, 0, 1]});
        }
    }

    return compiled;
}

function freeCompiledFrame(gl, frame){
    if(!frame || !frame.draw)
        return
    for(let f in frame.draw){
        if(f.buffer){
            gl.deleteBuffer(f.buffer)
        }
    }
}

class Camera{
    position;
    rotation;
    forward;
    right;
    up;
    viewMatrix;
    rotMatrix;
    trackPoint;
    trackDist;

    static #TempQuat = glMatrix.quat.create();
    static #TempVec = glMatrix.vec3.create();
    constructor(pos, rot){
        this.position = Array.from(pos);
        this.rotation = Array.from(rot);
        this.viewMatrix = glMatrix.mat4.create();
        this.rotMatrix = glMatrix.mat4.create();
        this.forward = glMatrix.vec3.create();
        this.right = glMatrix.vec3.create();
        this.up = glMatrix.vec3.create();

        this.trackPoint = null;
        this.trackDist = 100;

        this.update(true);
    }

    update(updRot){
        if(updRot){
            glMatrix.quat.identity(Camera.#TempQuat);
            glMatrix.quat.rotateX(Camera.#TempQuat, Camera.#TempQuat, this.rotation[0]);
            glMatrix.quat.rotateY(Camera.#TempQuat, Camera.#TempQuat, this.rotation[1]);
            glMatrix.quat.rotateZ(Camera.#TempQuat, Camera.#TempQuat, this.rotation[2]);
            glMatrix.mat3.fromQuat(this.rotMatrix, Camera.#TempQuat);
            this.right = glMatrix.vec3.fromValues(this.rotMatrix[0], this.rotMatrix[3], this.rotMatrix[6]);
            this.forward = glMatrix.vec3.fromValues(-this.rotMatrix[2], -this.rotMatrix[5], -this.rotMatrix[8]);
            this.up = glMatrix.vec3.fromValues(this.rotMatrix[1], this.rotMatrix[4], this.rotMatrix[7]);

            let t = this.viewMatrix[4];
            this.viewMatrix[4] = this.viewMatrix[1];
            this.viewMatrix[1] = t;
            t = this.viewMatrix[2];
            this.viewMatrix[2] = this.viewMatrix[8];
            this.viewMatrix[8] = t;
            t = this.viewMatrix[9];
            this.viewMatrix[9] = this.viewMatrix[6];
            this.viewMatrix[6] = t;
        }

        this.viewMatrix[0] = this.rotMatrix[0];
        this.viewMatrix[1] = this.rotMatrix[1];
        this.viewMatrix[2] = this.rotMatrix[2];
        this.viewMatrix[4] = this.rotMatrix[3];
        this.viewMatrix[5] = this.rotMatrix[4];
        this.viewMatrix[6] = this.rotMatrix[5];
        this.viewMatrix[8] = this.rotMatrix[6];
        this.viewMatrix[9] = this.rotMatrix[7];
        this.viewMatrix[10] = this.rotMatrix[8];

        this.viewMatrix[12] = 0;
        this.viewMatrix[13] = 0;
        this.viewMatrix[14] = 0;
        this.viewMatrix[15] = 1;

        if(this.trackPoint){
            glMatrix.vec3.scaleAndAdd(this.position, this.trackPoint, this.forward, -this.trackDist);
        }

        glMatrix.mat4.translate(this.viewMatrix, this.viewMatrix, glMatrix.vec3.negate(Camera.#TempVec, this.position));
    }
}

function main() {
    const canvas = document.getElementById("glcanvas");
    const gl = canvas.getContext("webgl2");
    const aspect = (canvas.width / canvas.height);

    /*let viewangle = 1.5;
    let viewdist = 1024;
    let viewpitch = 0.2;
    let vieworigin = [0,0,0];*/
    const camera = new Camera([1000,0,1000], [0,0,0]);
    const inputState = {w:0, s:0, d:0, a:0, up: 0, control: false};

    canvas.addEventListener("mouseover", (event)=>{
        inputState.control = true;
    });

    canvas.addEventListener("mouseleave", (event)=>{
        inputState.control = false;
    });

    window.addEventListener("keydown", (event)=>{
        if(!inputState.control) return;
        switch(event.key){
        case 'w':
            inputState.w = 1;
            break;
        case 's':
            inputState.s = 1;
            break;
        case 'a':
            inputState.a = 1;
            break;
        case 'd':
            inputState.d = 1;
            break;
        case "Space":
        case ' ':
            inputState.up = 1;
            break;
        case "Shift":
            inputState.up = -1;
            break;
        case "ArrowUp":
            inputState.lookup = 1;
            break;
        case "ArrowDown":
            inputState.lookdown = 1;
            break;
        case "ArrowLeft":
            inputState.lookleft = 1;
            break;
        case "ArrowRight":
            inputState.lookright = 1;
            break;
        }

        event.stopPropagation();
        event.preventDefault();
    });

    window.addEventListener("keyup", (event)=>{
        switch(event.key){
        case 'w':
            inputState.w = 0;
            break;
        case 's':
            inputState.s = 0;
            break;
        case 'a':
            inputState.a = 0;
            break;
        case 'd':
            inputState.d = 0;
            break;
        case ' ':
            inputState.up = 0;
            break;
        case "Shift":
            inputState.up = 0;
            break;
        case "ArrowUp":
            inputState.lookup = 0;
            break;
        case "ArrowDown":
            inputState.lookdown = 0;
            break;
        case "ArrowLeft":
            inputState.lookleft = 0;
            break;
        case "ArrowRight":
            inputState.lookright = 0;
            break;
        }
        if(!inputState.control) return;
        event.stopPropagation();
        event.preventDefault();
    })

    canvas.addEventListener("mousemove", (event) =>{
        if(event.buttons == 1){
            camera.rotation[0] += event.movementY * 0.003;
            camera.rotation[1] += event.movementX * 0.003;
            camera.update(true);
        }
    })

    if (gl === null) {
        alert(
            "Unable to initialize WebGL. Your browser or machine may not support it.",
        );
        return;
    }

    let drawGrid = document.getElementById("checkbox_drawgrid").checked;
    let drawWireframe = document.getElementById("checkbox_wireframe").checked;
    let showSideConstruction = document.getElementById("checkbox_sideconstruction").checked;
    let showClippingPlanes = document.getElementById("checkbox_drawplanes").checked;
    let draw3DSkybox = document.getElementById("checkbox_3dskybox").checked;
    let frametime = 1000*(1-(parseFloat(document.getElementById("range_animspeed").value)));
    let nextFrameTime = 0;
    let fogStart = 0;
    let fogEnd = 32768;
    let cameraTracking = document.getElementById("checkbox_trackcamera").checked;

    document.getElementById("checkbox_drawgrid").addEventListener("change", (event)=>{drawGrid = event.target.checked});
    document.getElementById("checkbox_wireframe").addEventListener("change", (event)=>{drawWireframe = event.target.checked});
    document.getElementById("checkbox_drawplanes").disabled = !showSideConstruction;
    document.getElementById("checkbox_sideconstruction").addEventListener("change", (event)=>{showSideConstruction = event.target.checked;
        document.getElementById("checkbox_drawplanes").disabled = !event.target.checked});
    document.getElementById("checkbox_drawplanes").addEventListener("change", (event)=>{showClippingPlanes = event.target.checked});
    document.getElementById("checkbox_3dskybox").addEventListener("change", (event)=>{draw3DSkybox = event.target.checked});
    document.getElementById("checkbox_trackcamera").addEventListener("change", (event)=>{
        cameraTracking = event.target.checked;
        camera.trackPoint = null;
    });
    document.getElementById("range_animspeed").addEventListener("input", (event)=>{frametime = 1000*(1-(parseFloat(event.target.value)));});
    document.getElementById("range_fogstart").addEventListener("input", (event)=>{fogStart = parseFloat(event.target.value);});
    document.getElementById("range_fogend").addEventListener("input", (event)=>{fogEnd = parseFloat(event.target.value);});

    let solidBuffer = null;
    let dispBuffer = null;
    let solidTriangles = 0;
    let totalTriangles = 0;
    let dispTriangles = 0;
    let totalDispTriangles = 0;
    let curAnimFrame = 0;
    let animFrames = null;
    let compiledAnimFrame = null;
    let forceNewFrame = false;
    let paused = true;
    let skyCamera = null;
    const pausebutton = document.getElementById("button_pause");
    const nextframebutton = document.getElementById("button_nextframe");
    const restartbutton = document.getElementById("button_restart");
    const skipbutton = document.getElementById("button_skip");
    const jumptobutton = document.getElementById("button_jumpto");
    const gotobutton = document.getElementById("button_goto");
    const errorLog = document.getElementById("error_log");

    const toggleControls = (b)=>{
        pausebutton.disabled = !b;
        nextframebutton.disabled = !b;
        restartbutton.disabled = !b;
        skipbutton.disabled = !b;
        jumptobutton.disabled = !b;
        gotobutton.disabled = !b;
    }

    toggleControls(false);

    const logError = (str)=>{
        errorLog.classList.add("errorlog_error");
        errorLog.innerHTML = str;
        setTimeout(()=>{errorLog.innerHTML = ""; errorLog.classList.remove("errorlog_error")}, 8000);
        console.log(str);
    }

    const logInfo = (str)=>{
        errorLog.classList.add("errorlog_info");
        errorLog.innerHTML = str;
        setTimeout(()=>{errorLog.innerHTML = ""; errorLog.classList.remove("errorlog_info")}, 8000);
        console.log(str);
    }

    const loadVmf = (newVmfData, method) => {
        let time1 = window.performance.now();

        freeCompiledFrame(gl, compiledAnimFrame);
        compiledAnimFrame = null;
        if(solidBuffer)
            gl.deleteBuffer(solidBuffer);
        if(dispBuffer)
            gl.deleteBuffer(dispBuffer);
        pausebutton.value = "Play";
        toggleControls(false);

        solidBuffer = gl.createBuffer()
        dispBuffer = gl.createBuffer()
        const parsed = parseFromVmflib(newVmfData.solids, parseInt(method || 0));

        for(const entity of newVmfData.entities){
            if(entity.classname == "sky_camera"){
                skyCamera = {origin: vmfLib.flipVector(entity.origin), fogStart: parseFloat(entity.fogstart), fogEnd: parseFloat(entity.fogend)};
            } else if(entity.classname == "env_fog_controller"){
                fogStart = parseFloat(entity.fogstart);
                fogEnd = parseFloat(entity.fogend);
                document.getElementById("range_fogstart").value = fogStart;
                document.getElementById("range_fogend").value = fogEnd;
            }
        }

        if(!parsed)
            return;

        curAnimFrame = 0;
        animFrames = parsed.animation;
        solidTriangles = 0;
        dispTriangles = 0;
        totalTriangles = parsed.numTriangles;
        totalDispTriangles = parsed.numDispTriangles;

        if(animFrames){
            toggleControls(true);
        }

        forceNewFrame = false;
        paused = true;

        logInfo(`Map loaded in ${window.performance.now() - time1} ms`);

        gl.bindBuffer(gl.ARRAY_BUFFER, solidBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, parsed.data, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, dispBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, parsed.dispData, gl.STATIC_DRAW);
    }

    let vmfData = null;
    const loadData = (dataInput) =>{
        const loadedString = (new TextDecoder("utf-8")).decode(dataInput);

        if(!loadedString)
            return;

        try{
            vmfData = vmfLib.parseVmf(loadedString);
            loadVmf(vmfData, document.getElementById("select_method").selectedOptions[0].value);
        } catch(error){
            console.log(error)
        }
    }

    const loadFile = (event)=>{
        let fileselect = event != null ? event.target : document.getElementById("button_file");
        if(!fileselect.files[0])
            return;
        let filereader = new FileReader();
        filereader.onload = ()=>{
            loadData(filereader.result);

            let shortname = fileselect.files[0].name || "";
            shortname = shortname.substring(Math.max(shortname.lastIndexOf("/"), shortname.lastIndexOf("\\"), 0));
            document.title = "VMF: " + shortname;
        }
        filereader.readAsArrayBuffer(fileselect.files[0]);
    }

    const searchSolid = (solidId)=>{
        if(!animFrames)
            return;

        for(const frame of animFrames){
            if(frame.frametype != "search")
                continue;
            if(frame.solidId == solidId)
                return frame;
        }

        return null;
    }

    document.getElementById("select_method").addEventListener("input", (event)=>{
        if(!vmfData)
            return;
        let skip = curAnimFrame >= animFrames.length;
        let solidid = -1;

        if(!skip){
            for(let i = curAnimFrame; i >= 0; --i){
                if(animFrames[i].frametype == "search"){
                    solidid = animFrames[i].solidId;
                    break;
                }
            }
        }

        loadVmf(vmfData, event.target.value);

        if(skip){
            freeCompiledFrame(gl, compiledAnimFrame);
            compiledAnimFrame = null;
            solidTriangles = totalTriangles;
            dispTriangles = totalDispTriangles;
            curAnimFrame = animFrames.length;
        } else if(solidid > -1){
            const foundFrame = searchSolid(solidid);

            if(foundFrame){
                freeCompiledFrame(gl, compiledAnimFrame);
                compiledAnimFrame = null;
                curAnimFrame = foundFrame.animFrame;
                solidTriangles = foundFrame.windingTriangles;
                dispTriangles = foundFrame.dispTriangles;
            }
        }
    });
    document.getElementById("button_file").addEventListener("input", loadFile);

    pausebutton.addEventListener("click", (event)=>{
        paused = !paused;
        pausebutton.value = paused ? "Play" : "Pause";
    })

    nextframebutton.addEventListener("click", (event)=>{
        forceNewFrame = true;
    })

    restartbutton.addEventListener("click", (event)=>{
        solidTriangles = 0;
        dispTriangles = 0;
        curAnimFrame = 0;
        freeCompiledFrame(gl, compiledAnimFrame);
        compiledAnimFrame = null;
    })

    skipbutton.addEventListener("click", (event)=>{
        solidTriangles = totalTriangles;
        dispTriangles = totalDispTriangles;
        freeCompiledFrame(gl, compiledAnimFrame);
        compiledAnimFrame = null;
        curAnimFrame = animFrames.length;
        camera.trackPoint = null;
    })

    jumptobutton.addEventListener("click", (event)=>{
        const solidId = +(document.getElementById("input_jumpto").value);

        if(isNaN(solidId)){
            logError("Invalid solid ID specified!");
            return;
        }

        const foundFrame = searchSolid(solidId);

        if(!foundFrame){
            logError("Solid with specified ID not found!");
            return;
        }

        freeCompiledFrame(gl, compiledAnimFrame);
        compiledAnimFrame = null;
        curAnimFrame = foundFrame.animFrame;
        solidTriangles = foundFrame.windingTriangles;
        dispTriangles = foundFrame.dispTriangles;
    })

    gotobutton.addEventListener("click", (event)=>{
        const solidId = +(document.getElementById("input_jumpto").value);

        if(isNaN(solidId)){
            logError("Invalid solid ID specified!");
            return;
        }

        const foundFrame = searchSolid(solidId);

        if(!foundFrame){
            logError("Solid with specified ID not found!");
            return;
        }

        if(!foundFrame.center){
            logError("Coordinates couldn't be found!");
            return;
        }

        camera.position = Array.from(foundFrame.center);
        camera.update(false);
    })

    const fogcolor = [1, 0.95, 0.9];
    const fogcolor2 = [0.7571, 0.7411, 0.73805];
    const skycolor = [0.43, 0.46, 0.52];

    const skyShd = createProgram(gl, `#version 300 es
        precision mediump float;

        in vec3 aVPos;
        out vec3 position;

        uniform mat4 view;
        uniform mat4 projection;

        void main() {
            gl_Position = projection * mat4(mat3(view)) * vec4(aVPos * 4096.0, 1.0);
            position = aVPos;
        }
    `,
    `   #version 300 es
        precision mediump float;
        uniform vec4 fogColor;
        uniform vec4 skyColor;

        in vec3 position;

        layout(location = 0) out vec4 color1;

        void main() {
            vec3 normal = normalize(position);

            float sc1 = (1.0-min(1.0, pow(1.0+normal.y, 11.0)));
            float sc2 = pow(1.0-normal.y, 2.5) * 1.0 + pow(normal.x, 3.0) * 0.5;
            vec4 sky = mix(skyColor, fogColor, sc2);

            color1 = mix(sky, skyColor * vec4(0.7, 0.7, 0.7, 1.0), min(sc1, 1.0));
        }
    `, {aVPos: 0});

    const genericShd = createProgram(gl, `#version 300 es
        precision mediump float;

        in vec3 aVPos;
        in vec4 aVColor;
        out vec4 outColor;
        out float outDist;

        uniform mat4 model;
        uniform mat4 projection;
        uniform mat4 view;

        void main() {
            outColor = aVColor;
            gl_Position = projection * view * model * vec4(aVPos, 1.0);
            outDist = gl_Position.z;
        }
    `,
    `   #version 300 es
        precision mediump float;
        uniform vec4 fogColor;
        uniform float fogIntensity;

        in vec4 outColor;
        in float outDist;

        layout(location = 0) out vec4 color1;

        uniform float fogMin;
        uniform float fogMax;

        void main() {
            float fogFactor = 1.0 / (fogMax - fogMin);
            float fog = (clamp(outDist, fogMin, fogMax) - fogMin) * fogFactor * fogIntensity;

            color1 = mix(outColor, fogColor, fog);
        }
    `, {aVPos: 0, aVColor: 1});

    const solidShd = createProgram(gl, `#version 300 es
        precision mediump float;

        in vec3 vpos;
        in vec3 vnormal;

        out vec3 outNormal;
        out vec4 ncsPos;
        out vec4 outColor;
        out float outDist;

        uniform mat4 projection;
        uniform mat4 view;
        uniform vec3 lightDir;
        uniform vec3 color;
        uniform vec3 scale;
        uniform float swizzleFactor;
        uniform float colorFactor;

        void main() {
            vec3 scaledPos = vpos * scale;
            gl_Position = projection * view * vec4(scaledPos, 1.0);

            vec3 swizzledNormal = vnormal * (1.0 - swizzleFactor) + vnormal.zxy * swizzleFactor;
            float diffuse = (1.0 - max(dot(lightDir, vnormal), 0.0) * 0.8);
            vec3 mixedColor = (color * colorFactor + (swizzledNormal * 0.5 + vec3(0.5)) * (1.0-colorFactor) );

            outColor = vec4( mixedColor * diffuse, 1.0 );
            outDist = gl_Position.z;
            outNormal = mat3(view) * vnormal;
            ncsPos = vec4(scaledPos, 1.0);
        }
    `,
    `   #version 300 es
        precision mediump float;
        uniform vec4 fogColor;
        uniform float fogIntensity;

        in vec3 outNormal;
        in vec4 ncsPos;
        in vec4 outColor;
        in float outDist;

        uniform vec3 lightDir;
        uniform mat4 view;
        uniform float fogMin;
        uniform float fogMax;
        uniform float specularFactor;

        layout(location = 0) out vec4 color1;
        layout(location = 1) out vec4 color2;

        const vec4 black = vec4(0.0);
        const vec4 white = vec4(1.0);

        void main() {
            float fogFactor = 1.0 / (fogMax - fogMin);
            vec3 lightDirTrans = mat3(view) * lightDir;
            vec3 reflected = reflect(lightDirTrans, outNormal);
            vec3 toViewer = normalize(-(view * ncsPos).xyz);

            float specular = max(dot(toViewer, reflected), 0.0);
            float fog = (clamp(outDist, fogMin, fogMax) - fogMin) * fogFactor * fogIntensity;
            float specularAmount = pow((clamp(specular, 0.9, 1.0) - 0.9) * 10.0, 2.0);

            color1 = mix(outColor + vec4(specularAmount) * specularFactor, fogColor, fog);
            color2 = mix(black, outColor + vec4(specularAmount), specularAmount * (1.0 - fog * 0.7));
            color2.a = 1.0;
        }
    `, {vpos: 0, vnormal: 1});

    const ppDefaultVertexPart = `#version 300 es
        precision mediump float;

        in vec2 vpos;
        in vec2 vtex;

        out vec2 outVtex;

        void main() {
            gl_Position = vec4(vpos, 0.0, 1.0);
            outVtex = vtex;
        }
    `
    const ppDefaultShd = createProgram(gl, ppDefaultVertexPart,
    `   #version 300 es
        precision mediump float;

        in vec2 outVtex;

        uniform sampler2D tex;

        layout(location = 0) out vec4 color1;

        void main() {
            color1 = texture(tex, outVtex);
        }
    `, {vpos: 0, vtex: 1});

    const ppBrightPassShd = createProgram(gl, ppDefaultVertexPart,
    `   #version 300 es
        precision mediump float;

        in vec2 outVtex;

        uniform sampler2D tex;

        layout(location = 0) out vec4 color1;

        const vec4 black = vec4(0.0);
        void main() {
            vec4 color = texture(tex, outVtex);

            color1 = mix(black, color, (clamp(length(color), 1.8, 2.0) - 1.8) * 5.0);
        }
    `, {vpos: 0, vtex: 1});

    const ppBlurShd = createProgram(gl, ppDefaultVertexPart,
    `   #version 300 es
        precision mediump float;

        in vec2 outVtex;

        uniform sampler2D tex;
        uniform vec2 texOffset;
        const float weights[10] = float[](0.1585, 0.1465, 0.1156, 0.0779, 0.0448, 0.0220, 0.0092, 0.0033, 0.0010, 0.0003);

        layout(location = 0) out vec4 color1;

        void main() {
            vec4 result = texture(tex, outVtex) * weights[0];
            float j = 1.0;
            for(int i = 1; i < 10; i += 1){
                result += weights[i] * texture(tex, outVtex + texOffset * j);
                result += weights[i] * texture(tex, outVtex - texOffset * j);
                j += 1.0;
            }
            color1 = result;
        }
    `, {vpos: 0, vtex: 1});

    const ppMixAddShd = createProgram(gl, ppDefaultVertexPart,
    `   #version 300 es
        precision mediump float;

        in vec2 outVtex;

        uniform sampler2D tex1;
        uniform sampler2D tex2;
        uniform float factor1;
        uniform float factor2;

        layout(location = 0) out vec4 color1;

        void main() {
            vec4 finalColor = (texture(tex1, outVtex) * factor1 + texture(tex2, outVtex) * factor2);
            color1 = finalColor;
        }
    `, {vpos: 0, vtex: 1});

    /*grid lines*/
    const gridSize = MAXMAPSIZE / 4;
    const gridCell = 2048;
    const gridScale = (gridSize / gridCell);
    const gridScaleLog = Math.log2(gridScale);

    let gridDetails = [0, gridScale];
    for(let i = 2; i < Math.log2(gridCell); ++i){
        gridDetails[i] = gridDetails[i - 1] + (2 << (i + gridScaleLog - 2));
    }

    const gridBase = (gridScale * 2 + 1) * 2 + 1;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, generateGridLineBuffer(gridSize, gridCell), gl.STATIC_DRAW);

    /*Matrices*/
    const projection = glMatrix.mat4.create();
    glMatrix.mat4.perspective(projection, 1.22, aspect, 4, 32768);
    const skyProjection = glMatrix.mat4.create();
    glMatrix.mat4.perspective(skyProjection, 1.22, aspect, 16, 524288);

    document.getElementById("range_fovizm").addEventListener("input", (event)=>{
        glMatrix.mat4.perspective(projection, parseFloat(event.target.value) * 0.01745, aspect, 4, 32768);
        glMatrix.mat4.perspective(skyProjection, parseFloat(event.target.value) * 0.01745, aspect, 16, 524288);
    });
    const view = glMatrix.mat4.create();
    const identity = glMatrix.mat4.create();

    /*Axis arrows*/
    const bufferAxArr = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferAxArr);
    gl.bufferData(gl.ARRAY_BUFFER, 432*3, gl.STATIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, generateArrowBuffer([0,0,0], [0,256,0], [0, 255, 0, 255], 5));
    gl.bufferSubData(gl.ARRAY_BUFFER, 432, generateArrowBuffer([0,0,0], [0,0,256], [100, 100, 255, 255], 5));
    gl.bufferSubData(gl.ARRAY_BUFFER, 432*2, generateArrowBuffer([0,0,0], [256,0,0], [255, 0, 0, 255], 5));

    const bufferPoint = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferPoint);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -8, 0, 0,   0, -8, 0,   0, 8, 0,   0, 8, 0,   0, -8, 0,   8, 0, 0,
        0, 0, -8,   0, -8, 0,   0, 8, 0,   0, 8, 0,   0, -8, 0,   0, 0, 8,
        -8, 0, 0,   0, 0, 8,   0, 0, -8,   0, 0, -8,   0, 0, 8,   8, 0, 0,
    ]), gl.STATIC_DRAW);

    const screenQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, 1, 0, 1,   -1, -1, 0, 0,   1, -1, 1, 0,
        -1, 1, 0, 1,   1, -1, 1, 0,   1, 1, 1, 1
    ]), gl.STATIC_DRAW);

    /*Sky*/
    const bufferSky = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferSky);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, 1, -1, -1, -1, -1, 1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1,
        1, -1, 1, -1, -1, 1,-1, 1, 1, 1, 1, 1, 1, -1, 1,-1, 1, 1,
        1, 1, -1, 1, -1, -1, 1, -1, 1, 1, 1, -1, 1, -1, 1, 1, 1, 1,
        -1, -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 1, -1,
        -1, 1, 1, -1, 1, -1, 1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, 1,
        1, -1, -1,-1, -1, -1,-1, -1, 1,1, -1, 1,1, -1, -1,-1, -1, 1,
    ]), gl.STATIC_DRAW);

    let lightDir = glMatrix.vec3.normalize(glMatrix.vec3.create(), [-1, -0.4, 0.3]);

    const mainFrameBuffer = gl.createFramebuffer();
    const mainFrameBufferRender = gl.createRenderbuffer();
    const mainFrameBufferFog = gl.createRenderbuffer();
    const mainFrameBufferDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, mainFrameBufferRender);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 6, gl.RGBA8, canvas.width, canvas.height);

    gl.bindRenderbuffer(gl.RENDERBUFFER, mainFrameBufferFog);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 6, gl.RGBA8, canvas.width, canvas.height);

    gl.bindRenderbuffer(gl.RENDERBUFFER, mainFrameBufferDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 6, gl.DEPTH_COMPONENT16, canvas.width, canvas.height);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, mainFrameBuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, mainFrameBufferRender);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.RENDERBUFFER, mainFrameBufferFog);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, mainFrameBufferDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const auxFrameBuffer = gl.createFramebuffer();
    const auxFrameBufferTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, auxFrameBufferTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindFramebuffer(gl.FRAMEBUFFER, auxFrameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, auxFrameBufferTexture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const pingPongBuffers = [];
    const pingPongTextures = [];
    let pingPongId = 0;
    for(let i = 0; i < 2; ++i){
        const pingPongBuff = gl.createFramebuffer();
        const pingPongTex = gl.createTexture();
        gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongBuff);
        gl.bindTexture(gl.TEXTURE_2D, pingPongTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pingPongTex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        pingPongBuffers.push(pingPongBuff);
        pingPongTextures.push(pingPongTex);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const tempVector = glMatrix.vec3.create();
    const fogcolorLerp = glMatrix.vec3.create();
    
    let lastTime = 0;
    let deltaTime = 0;
    const render = (time) => {
        deltaTime = time * 0.001 - lastTime;
        lastTime = time * 0.001;

        if(inputState.lookleft > 0){
            camera.rotation[1] -= 3 * deltaTime;
        } else if(inputState.lookright > 0){
            camera.rotation[1] += 3 * deltaTime;
        }

        if(inputState.lookup > 0){
            camera.rotation[0] -= 3 * deltaTime;
        } else if(inputState.lookdown > 0){
            camera.rotation[0] += 3 * deltaTime;
        }

        if(camera.trackPoint){
            if(inputState.s > 0)
                camera.trackDist += 1600 * deltaTime;
            else if(inputState.w > 0)
                camera.trackDist = Math.max(camera.trackDist - 1600 * deltaTime, 0);
        } else {
            if(inputState.w > 0)
                glMatrix.vec3.scaleAndAdd(camera.position, camera.position, camera.forward, 1600 * deltaTime);
            else if(inputState.s > 0)
                glMatrix.vec3.scaleAndAdd(camera.position, camera.position, camera.forward, -1600 * deltaTime);
            if(inputState.d > 0)
                glMatrix.vec3.scaleAndAdd(camera.position, camera.position, camera.right, 1600 * deltaTime);
            else if(inputState.a > 0)
                glMatrix.vec3.scaleAndAdd(camera.position, camera.position, camera.right, -1600 * deltaTime);
            if(inputState.up != 0)
                glMatrix.vec3.scaleAndAdd(camera.position, camera.position, [0, 1, 0], inputState.up * 1600 * deltaTime);
        }

        camera.update(true);

        if(time > nextFrameTime && animFrames && !paused || forceNewFrame){
            freeCompiledFrame(gl, compiledAnimFrame);
            compiledAnimFrame = null;
            if(curAnimFrame >= animFrames.length){
                paused = true;
                pausebutton.value = "Play";
                camera.trackPoint = null;
            } else {
                for(; curAnimFrame < animFrames.length; ++curAnimFrame){
                    if(animFrames[curAnimFrame].frametype == "d" && showSideConstruction){
                        if(animFrames[curAnimFrame].toprint){
                            console.log.apply(null, animFrames[curAnimFrame].toprint);
                        }
                        compiledAnimFrame = compileAnimFrame(gl, animFrames[curAnimFrame].data);
                        break;
                    } else if(animFrames[curAnimFrame].frametype == "ab"){
                        let start = animFrames[curAnimFrame].start;
                        let disp = animFrames[curAnimFrame].disp

                        if(disp){
                            if(start < 0)
                                start = dispTriangles;
                            dispTriangles = start + animFrames[curAnimFrame].add;
                        } else {
                            if(start < 0)
                                start = solidTriangles;
                            solidTriangles = start + animFrames[curAnimFrame].add;
                        }
                        
                        if(!showSideConstruction && !disp || disp && showSideConstruction)
                            break;
                    } else if(animFrames[curAnimFrame].frametype == "search" && cameraTracking){
                        const center = animFrames[curAnimFrame].center;
                        if(center){
                            camera.trackPoint = center;
                            camera.update(false);
                        }
                    } else if(animFrames[curAnimFrame].frametype == "nd")
                        break;
                }

                nextFrameTime = time + frametime;
            }

            forceNewFrame = false;
            ++curAnimFrame;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, mainFrameBuffer);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

        gl.clearColor(0, 0, 0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);

        /*let cospitch = Math.cos(viewpitch);
        const eyepos = [Math.cos(-viewangle) * viewdist * cospitch, Math.sin(viewpitch) * viewdist, Math.sin(viewangle) * viewdist * cospitch];
        glMatrix.mat4.lookAt(view, eyepos, [0, 0, 0], [0, 1, 0]);
        glMatrix.mat4.translate(view, view, glMatrix.vec3.negate(tempVector, vieworigin));*/
        
        //glMatrix.vec3.lerp(fogcolorLerp, fogcolor, fogcolor2, Math.cos(viewangle) * 0.5 + 0.5);
        glMatrix.vec3.lerp(fogcolorLerp, fogcolor2, fogcolor, camera.forward[0] * 0.5 + 0.5);

        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);

        gl.useProgram(skyShd.id);
        gl.uniformMatrix4fv(skyShd.uniforms.get("view"), false, camera.viewMatrix);
        gl.uniformMatrix4fv(skyShd.uniforms.get("projection"), false, projection);
        gl.uniform4f(skyShd.uniforms.get("fogColor"), fogcolor[0], fogcolor[1], fogcolor[2], 1.0);
        gl.uniform4f(skyShd.uniforms.get("skyColor"), skycolor[0], skycolor[1], skycolor[2], 1.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferSky)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        /*draw solids*/
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
        gl.useProgram(solidShd.id);
        for(let i = (skyCamera && draw3DSkybox ? 0 : 1); i < 2; ++i){
            if(i == 1){
                gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.uniformMatrix4fv(solidShd.uniforms.get("projection"), false, projection);
                gl.uniform3f(solidShd.uniforms.get("scale"), 1, 1, 1);
                gl.uniform1f(solidShd.uniforms.get("fogMin"), fogStart);
                gl.uniform1f(solidShd.uniforms.get("fogMax"), fogEnd);
                gl.uniformMatrix4fv(solidShd.uniforms.get("view"), false, camera.viewMatrix);
            } else {
                const skyView = glMatrix.mat4.create();
                glMatrix.mat4.translate(skyView, camera.viewMatrix, glMatrix.vec3.scale(tempVector, skyCamera.origin, -16));
                gl.uniformMatrix4fv(solidShd.uniforms.get("projection"), false, skyProjection);
                gl.uniform3f(solidShd.uniforms.get("scale"), 16, 16, 16);
                gl.uniform1f(solidShd.uniforms.get("fogMin"), fogStart);
                gl.uniform1f(solidShd.uniforms.get("fogMax"), fogEnd);
                gl.uniformMatrix4fv(solidShd.uniforms.get("view"), false, skyView);
            }

            gl.uniform3f(solidShd.uniforms.get("lightDir"), lightDir[0], lightDir[1], lightDir[2]);
            gl.uniform4f(solidShd.uniforms.get("fogColor"), fogcolorLerp[0], fogcolorLerp[1], fogcolorLerp[2], 1.0);
            gl.uniform1f(solidShd.uniforms.get("fogIntensity"), 1);
            gl.uniform1f(solidShd.uniforms.get("specularFactor"), 0.25);

            if(solidBuffer && solidTriangles > 0){
                gl.bindBuffer(gl.ARRAY_BUFFER, solidBuffer);
                gl.enableVertexAttribArray(0);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
                gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
                gl.uniform3f(solidShd.uniforms.get("color"), 0.5, 0.7, 0.5);
                gl.uniform1f(solidShd.uniforms.get("swizzleFactor"), 0);
                gl.uniform1f(solidShd.uniforms.get("colorFactor"), 0.3);
                gl.drawArrays(gl.TRIANGLES, 0, solidTriangles*3);

                if(drawWireframe && i > 0){
                    gl.disableVertexAttribArray(1);
                    gl.vertexAttrib3f(1, 1, 1, 1);
                    for(let i = 0; i < solidTriangles; ++i){
                        gl.drawArrays(gl.LINE_LOOP, i * 3, 3);
                    }
                }
            }

            if(dispBuffer && dispTriangles > 0){
                gl.uniform1f(solidShd.uniforms.get("swizzleFactor"), 1);
                gl.uniform3f(solidShd.uniforms.get("color"), 0.7, 0.5, 0.7);
                gl.uniform1f(solidShd.uniforms.get("colorFactor"), 0.4);

                gl.bindBuffer(gl.ARRAY_BUFFER, dispBuffer);
                gl.enableVertexAttribArray(0);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
                gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);

                gl.drawArrays(gl.TRIANGLES, 0, dispTriangles*3);

                if(drawWireframe && i > 0){
                    gl.disableVertexAttribArray(1);
                    gl.vertexAttrib3f(1, 1, 1, 1);

                    for(let i = 0; i < dispTriangles; ++i){
                        gl.drawArrays(gl.LINE_LOOP, i * 3, 3);
                    }
                }
            }
        }
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);

        gl.useProgram(genericShd.id);
        gl.uniformMatrix4fv(genericShd.uniforms.get("projection"), false, projection);
        gl.uniformMatrix4fv(genericShd.uniforms.get("view"), false, camera.viewMatrix);
        gl.uniformMatrix4fv(genericShd.uniforms.get("model"), false, identity);
        gl.uniform4f(genericShd.uniforms.get("fogColor"), fogcolorLerp[0], fogcolorLerp[1], fogcolorLerp[2], 1.0);
        gl.uniform1f(genericShd.uniforms.get("fogIntensity"), 1.0);
        gl.uniform1f(genericShd.uniforms.get("fogMin"), fogStart);
        gl.uniform1f(genericShd.uniforms.get("fogMax"), fogEnd);
        if(drawGrid){
            gl.uniform1f(genericShd.uniforms.get("fogIntensity"), 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.enableVertexAttribArray(0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
            gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 16, 12);

            const distToGrid = Math.abs(camera.position[1]);
            let detail = Math.max(Math.min(gridDetails.length-Math.floor(Math.log2(distToGrid)) - 2, gridDetails.length - 2), 0);

            gl.drawArrays(gl.LINES, 0, (gridBase + gridDetails[detail] * 4) * 2);

            gl.disableVertexAttribArray(0);
            gl.disableVertexAttribArray(1);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferAxArr);
            gl.enableVertexAttribArray(0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
            gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 16, 12);
            gl.drawArrays(gl.TRIANGLES, 0, 27*3);
            gl.disableVertexAttribArray(0);
            gl.disableVertexAttribArray(1);
        }

        if(compiledAnimFrame){
            gl.disable(gl.CULL_FACE);
            gl.uniform1f(genericShd.uniforms.get("fogIntensity"), 0.6);

            for(let i = 0; i < compiledAnimFrame.draw.length; ++i){
                let dr = compiledAnimFrame.draw[i];

                //winding
                if(dr.type != "w") continue;
                gl.bindBuffer(gl.ARRAY_BUFFER, dr.buffer);
                gl.enableVertexAttribArray(0);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
                gl.vertexAttribPointer(1, 3, gl.UNSIGNED_BYTE, true, 16, 12);
                gl.drawArrays(gl.TRIANGLES, 0, dr.elements * 3);
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferPoint);
            gl.enableVertexAttribArray(0);
            gl.disableVertexAttribArray(1);
            gl.disableVertexAttribArray(2);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

            for(let i = 0; i < compiledAnimFrame.draw.length; ++i){
                let dr = compiledAnimFrame.draw[i];

                //point
                if(dr.type != "pt") continue;

                gl.uniformMatrix4fv(genericShd.uniforms.get("model"), false, glMatrix.mat4.fromTranslation(glMatrix.mat4.create(), dr.data));
                gl.vertexAttrib4f(1, dr.color[0], dr.color[1], dr.color[2], 1);
                gl.drawArrays(gl.TRIANGLES, 0, 18);
            }
            gl.uniformMatrix4fv(genericShd.uniforms.get("model"), false, identity);

            gl.uniform1f(genericShd.uniforms.get("fogIntensity"), 0.0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.blendEquation(gl.FUNC_ADD);
            gl.depthMask(false);
            for(let i = 0; i < compiledAnimFrame.draw.length && showClippingPlanes; ++i){
                let dr = compiledAnimFrame.draw[i];

                //plane
                if(dr.type != "p") continue;
                gl.bindBuffer(gl.ARRAY_BUFFER, dr.buffer);
                gl.enableVertexAttribArray(0);
                gl.disableVertexAttribArray(1);
                gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
                gl.vertexAttrib4f(1, dr.color[0], dr.color[1], dr.color[2], 0.3);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }

        pingPongId = pingPongId & 1;
        /*Copy main COLOR_ATTACHMENT0 into auxFrameBuffer*/
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, mainFrameBuffer);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, auxFrameBuffer);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.blitFramebuffer(0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

        /*Copy main COLOR_ATTACHMENT1 into pingPongBuffer*/
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, mainFrameBuffer);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);

        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, pingPongBuffers[pingPongId & 1]);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.blitFramebuffer(0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);

        /*Post processing*/
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        gl.bindBuffer(gl.ARRAY_BUFFER, screenQuadBuffer)
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

        /*Blur*/
        gl.useProgram(ppBlurShd.id);
        gl.uniform1i(ppBlurShd.uniforms.get("tex"), 0);
        gl.uniform2f(ppBlurShd.uniforms.get("texOffset"), 2.0/canvas.width, 0);
        const passes = 15;
        for(let i = 0; i < passes; ++i){
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pingPongTextures[(pingPongId++) & 1]);
            gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongBuffers[pingPongId & 1]);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.uniform2f(ppBlurShd.uniforms.get("texOffset"), 0, 2.0/canvas.height);
        for(let i = 0; i < passes * 0.5; ++i){
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pingPongTextures[(pingPongId++) & 1]);
            gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongBuffers[pingPongId & 1]);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

        /*Final draw*/
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawBuffers([gl.BACK]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, auxFrameBufferTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, pingPongTextures[pingPongId & 1]);

        gl.useProgram(ppMixAddShd.id);
        gl.uniform1i(ppMixAddShd.uniforms.get("tex1"), 0);
        gl.uniform1i(ppMixAddShd.uniforms.get("tex2"), 1);
        gl.uniform1f(ppMixAddShd.uniforms.get("factor1"), 1.0);
        gl.uniform1f(ppMixAddShd.uniforms.get("factor2"), 0.3);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        window.requestAnimationFrame(render);
    }

    render(0);
}

addEventListener("DOMContentLoaded", (event)=>{
    main();
})