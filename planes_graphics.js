'use strict';

/*
============ Drawing / graphical stuffies ============
*/

function createProgram(gl, vsrc, fsrc, attmap){
    const vshader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vshader, vsrc);
    gl.compileShader(vshader);

    if(!gl.getShaderParameter(vshader, gl.COMPILE_STATUS)){
        console.error("failed to compile vertex shader! " + gl.getShaderInfoLog(vshader) );
        gl.deleteShader(vshader);

        return null;
    }

    const fshader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fshader, fsrc);
    gl.compileShader(fshader);

    if(!gl.getShaderParameter(fshader, gl.COMPILE_STATUS)){
        console.error("failed to compile fragment shader! " + gl.getShaderInfoLog(fshader) );

        gl.deleteShader(vshader);
        gl.deleteShader(fshader);
        return null;
    }

    const program = gl.createProgram()
    gl.attachShader(program, vshader);
    gl.attachShader(program, fshader);

    if(attmap){
        for(let k in attmap){
            gl.bindAttribLocation(program, attmap[k], k);
        }
    }

    gl.linkProgram(program);

    const attMap = new Map();
    const numAtts = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for(let i = 0; i < numAtts; ++i){
        const name = gl.getActiveAttrib(program, i).name;
        attMap.set(name, gl.getAttribLocation(program, name));
    }

    const uniMap = new Map();
    const numUnis = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for(let i = 0; i < numUnis; ++i){
        const name = gl.getActiveUniform(program, i).name;
        uniMap.set(name, gl.getUniformLocation(program, name));
    }

    gl.detachShader(program, vshader);
    gl.detachShader(program, fshader);
    gl.deleteShader(vshader);
    gl.deleteShader(fshader);

    const progStruct = {
        id: program,
        uniforms: uniMap
    };

    return progStruct;
}

function generateGridLineBuffer(gridsize, biggest){
    const lines = Math.ceil(gridsize/biggest) * biggest;
    const buffer = new ArrayBuffer((lines*4 + 5) * 32);
    const dataview = new DataView(buffer);
    let offset = 32;

    const gridR = 40;
    const gridG = 40;
    const gridB = 40;
    const addLine = (dataview, offset, x1, y1, z1, x2, y2, z2, r, g, b) =>{
        dataview.setFloat32(offset, x1, true);dataview.setFloat32(offset + 4, y1, true);dataview.setFloat32(offset + 8, z1, true);
        dataview.setUint8(offset + 12, r);dataview.setUint8(offset + 13, g);dataview.setUint8(offset + 14, b);dataview.setUint8(offset + 15, 255);
        
        dataview.setFloat32(offset + 16, x2, true);dataview.setFloat32(offset + 20, y2, true);dataview.setFloat32(offset + 24, z2, true);
        dataview.setUint8(offset + 28, r);dataview.setUint8(offset + 29, g);dataview.setUint8(offset + 30, b);dataview.setUint8(offset + 31, 255);
    }
    addLine(dataview, 0, 0, -(lines), 0, 0, (lines), 0, 0, 255, 0);

    const scale = lines / biggest;
    for(let i = 0; i < scale*2 + 1; ++i){
            addLine(dataview, offset + i * 64, -lines + i * biggest, 0, -lines, -lines + i * biggest, 0, lines, 100, 100, 100);
            addLine(dataview, offset + i * 64 + 32, -lines, 0, -lines + i * biggest, lines, 0, -lines + i * biggest, 100, 100, 100);
    }
    dataview.setUint8(offset + scale * 64 + 12, 100);dataview.setUint8(offset + scale * 64 + 13, 100);dataview.setUint8(offset + scale * 64 + 14, 255);dataview.setUint8(offset + scale * 64 + 15, 255);
    dataview.setUint8(offset + scale * 64 + 28, 100);dataview.setUint8(offset + scale * 64 + 29, 100);dataview.setUint8(offset + scale * 64 + 30, 255);dataview.setUint8(offset + scale * 64 + 31, 255);
    dataview.setUint8(offset + scale * 64 + 44, 255);dataview.setUint8(offset + scale * 64 + 45, 0);dataview.setUint8(offset + scale * 64 + 46, 0);dataview.setUint8(offset + scale * 64 + 47, 255);
    dataview.setUint8(offset + scale * 64 + 60, 255);dataview.setUint8(offset + scale * 64 + 61, 0);dataview.setUint8(offset + scale * 64 + 62, 0);dataview.setUint8(offset + scale * 64 + 63, 255);
    offset += (scale*2 + 1) * 64;

    for(let i = 1; i < biggest; i *= 2){
        let spacing = biggest / i;
        let off = spacing / 2;

        for(let j = 0; j < i * scale; ++j){
            addLine(dataview, offset, -off - j * spacing, 0, -lines, -off - j * spacing, 0, lines, gridR, gridG, gridB);
            addLine(dataview, offset + 32, off + j * spacing, 0, -lines, off + j * spacing, 0, lines, gridR, gridG, gridB);
            addLine(dataview, offset + 64, -lines, 0, off + j * spacing, lines, 0, off + j * spacing, gridR, gridG, gridB);
            addLine(dataview, offset + 96, -lines, 0, -off - j * spacing, lines, 0, -off - j * spacing, gridR, gridG, gridB);
            offset += 128;
        }
    }

    return buffer;
}

function generateArrowBuffer(p0, p1, color, scale){
    const buffer = new ArrayBuffer(16 * 3 * 9);
    const dataview = new DataView(buffer);
    const tovec = glMatrix.vec3.fromValues(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    const len = glMatrix.vec3.len(tovec);
    const normal = glMatrix.vec3.normalize(glMatrix.vec3.create(), tovec);

    let m = Math.abs(normal[0]);
    let i = 0;
    for(let j = 1; j < 3; ++j){
        if(m > Math.abs(normal[j])){
            m = Math.abs(normal[j]);
            i = j;
        }
    }

    const up = glMatrix.vec3.create();
    if(i == 0){
        glMatrix.vec3.set(up, 1, 0, 0);
    }if(i == 1){
        glMatrix.vec3.set(up, 0, 1, 0);
    } else if(i == 2){
        glMatrix.vec3.set(up, 0, 0, 1);
    }
    const forward = glMatrix.vec3.cross(glMatrix.vec3.create(), up, normal);
    glMatrix.vec3.normalize(forward, forward);
    const right = glMatrix.vec3.cross(glMatrix.vec3.create(), normal, forward);

    const mat = glMatrix.mat3.fromValues(
        right[0], right[1], right[2],
        normal[0], normal[1], normal[2],
        forward[0], forward[1], forward[2]
    )
    const add = glMatrix.vec3.fromValues(p0[0], p0[1], p0[2]);
    const scl = scale || 1.28;
    const h = scl*1.73205;
    const arrowh = 5 * scl;
    const a1 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(-scl, 0, -h*0.333), mat), add);
    const a2 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(scl, 0, -h*0.333), mat), add);
    const a3 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(-scl, len-arrowh, -h*0.333), mat), add);
    const a4 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(scl, len-arrowh, -h*0.333), mat), add);
    const a5 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(0, len-arrowh, h * 0.666), mat), add);
    const a6 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(0, 0, h * 0.666), mat), add);

    const arrowscale = 2;
    const a7 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(-scl * arrowscale, len-arrowh, -h*0.333* arrowscale), mat), add);
    const a8 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(scl* arrowscale, len-arrowh, -h*0.333* arrowscale), mat), add);
    const a9 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(0, len-arrowh, h * 0.666* arrowscale), mat), add);
    const a10 = glMatrix.vec3.add(glMatrix.vec3.create(), glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(0, len, 0), mat), add);

    const addtri = (offset, p1, p2, p3) =>{
        dataview.setFloat32(offset + 0, p1[0], true);dataview.setFloat32(offset + 4, p1[1], true);dataview.setFloat32(offset + 8, p1[2], true);
        dataview.setUint8(offset + 12, color[0]);dataview.setUint8(offset + 13, color[1]);dataview.setUint8(offset + 14, color[2]);dataview.setUint8(offset + 15, color[3]);
        dataview.setFloat32(offset + 16, p2[0], true);dataview.setFloat32(offset + 20, p2[1], true);dataview.setFloat32(offset + 24, p2[2], true);
        dataview.setUint8(offset + 28, color[0]);dataview.setUint8(offset + 29, color[1]);dataview.setUint8(offset + 30, color[2]);dataview.setUint8(offset + 31, color[3]);
        dataview.setFloat32(offset + 32, p3[0], true);dataview.setFloat32(offset + 36, p3[1], true);dataview.setFloat32(offset + 40, p3[2], true);
        dataview.setUint8(offset + 44, color[0]);dataview.setUint8(offset + 45, color[1]);dataview.setUint8(offset + 46, color[2]);dataview.setUint8(offset + 47, color[3]);
    }

    addtri(0,a2,a1,a3);
    addtri(48,a4,a2,a3);
    addtri(48 * 2,a1,a6,a5);
    addtri(48 * 3,a3,a1,a5);
    addtri(48 * 4,a6,a2,a4);
    addtri(48 * 5,a5,a6,a4);

    addtri(48 * 6,a7,a9,a10);
    addtri(48 * 7,a8,a7,a10);
    addtri(48 * 8,a9,a8,a10);

    return buffer;
}

function windingToBuffer(winding, buffer, boffset, color){
    if((winding.length - 2) * 3 * 84 > buffer.byteLength)
        return 0

    const dataView = new DataView(buffer, boffset);
    const p1 = winding[0];
    const p2 = winding[1];
    const p3 = winding[2];
    const normal = glMatrix.vec3.cross(glMatrix.vec3.create(), [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]], [p2[0] - p3[0], p2[1] - p3[1], p2[2] - p3[2]]);
    glMatrix.vec3.normalize(normal, normal);

    color = color || [(normal[0] * 0.5 + 0.5) * 255, (normal[1] * 0.5 + 0.5) * 255, (normal[2] * 0.5 + 0.5) * 255, 255];

    let offset = 0;
    //triangle fan triangulation
    for(let i = 0; i < winding.length - 2; ++i){
        dataView.setFloat32(offset, winding[0][0], true);dataView.setFloat32(offset + 4, winding[0][1], true);dataView.setFloat32(offset + 8, winding[0][2], true);
        dataView.setUint8(offset + 12, color[0]); dataView.setUint8(offset + 13, color[1]); dataView.setUint8(offset + 14, color[2]); dataView.setUint8(offset + 15, color[3]);
        dataView.setFloat32(offset + 16, winding[i+2][0], true);dataView.setFloat32(offset + 20, winding[i+2][1], true);dataView.setFloat32(offset + 24, winding[i+2][2], true);
        dataView.setUint8(offset + 28, color[0]); dataView.setUint8(offset + 29, color[1]); dataView.setUint8(offset + 30, color[2]); dataView.setUint8(offset + 31, color[3]);
        dataView.setFloat32(offset + 32, winding[i+1][0], true);dataView.setFloat32(offset + 36, winding[i+1][1], true);dataView.setFloat32(offset + 40, winding[i+1][2], true);
        dataView.setUint8(offset + 44, color[0]); dataView.setUint8(offset + 45, color[1]); dataView.setUint8(offset + 46, color[2]); dataView.setUint8(offset + 47, color[3]);

        offset += 48;
    }

    return offset;
}