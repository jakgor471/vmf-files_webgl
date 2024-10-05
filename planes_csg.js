"use strict";

/*
============ Plane thingies ============
*/
const EPSILON = 1.0/512;

function planeFromTri(p1, p2, p3){
    let normal = glMatrix.vec3.cross(glMatrix.vec3.create(), [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]], [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]]);
    glMatrix.vec3.normalize(normal, normal);

    let dist = glMatrix.vec3.dot(normal, p1);
    return [normal[0], normal[1], normal[2], dist];
}

function baseWinding2(plane, size){
    /*Projects 4 points from AA plane onto the side's plane*/
    let max = Math.abs(plane[0]);
    let i = 0;
    for(let j = 1; j < 3; ++j){
        if(max < Math.abs(plane[j])){
            max = Math.abs(plane[j]);
            i = j;
        }
    }

    const normal = glMatrix.vec3.set(glMatrix.vec3.create(), 0, -1, 0);
    const planeN = glMatrix.vec3.fromValues(plane[0], plane[1], plane[2]);
    const sign = (plane[i] < 0 ? -1 : 1);

    const mat = glMatrix.mat3.fromValues(
        sign, 0, 0,
        0, sign, 0,
        0, 0, sign,
    );
    if(i == 0){
        glMatrix.vec3.set(normal, 1, 0, 0);
        glMatrix.mat3.set(mat,
            0, sign, 0,
            sign, 0, 0,
            0, 0, 1
        );
    } else if(i == 2){
        glMatrix.vec3.set(normal, 0, 0, 1);
        glMatrix.mat3.set(mat,
            1, 0, 0,
            0, 0, sign,
            0, sign, 0
        );
    }
    const half = Math.floor(size/2.0);
    const dotReciprocal = 1.0 / glMatrix.vec3.dot(normal, planeN);
    const p1 = glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(-half, 0, half), mat);
    let t = (plane[3] - glMatrix.vec3.dot(p1, planeN)) * dotReciprocal;
    glMatrix.vec3.scaleAndAdd(p1, p1, normal, t);
    const p2 = glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(-half, 0, -half), mat);
    t = (plane[3] - glMatrix.vec3.dot(p2, planeN)) * dotReciprocal;
    glMatrix.vec3.scaleAndAdd(p2, p2, normal, t);
    const p3 = glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(half, 0, -half), mat);
    t = (plane[3] - glMatrix.vec3.dot(p3, planeN)) * dotReciprocal;
    glMatrix.vec3.scaleAndAdd(p3, p3, normal, t);
    const p4 = glMatrix.vec3.transformMat3(glMatrix.vec3.create(), glMatrix.vec3.fromValues(half, 0, half), mat);
    t = (plane[3] - glMatrix.vec3.dot(p4, planeN)) * dotReciprocal;
    glMatrix.vec3.scaleAndAdd(p4, p4, normal, t);

    if(i == 1 && planeN[1] > 0){
        return [p4, p3, p2, p1];
    }

    return [p1, p2, p3, p4];
}

function baseWinding(plane, size){
    const globalUp = glMatrix.vec3.create(0, 0, 0);
    let max = Math.abs(plane[0]);
    let i = 0;
    for(let j = 1; j < 3; ++j){
        if(max < Math.abs(plane[j])){
            max = Math.abs(plane[j]);
            i = j;
        }
    }

    if(i == 1)
        globalUp[0] = 1;
    else
        globalUp[1] = 1;

    const right = glMatrix.vec3.cross(glMatrix.vec3.create(), plane, globalUp);
    glMatrix.vec3.normalize(right, right);
    glMatrix.vec3.scale(right, right, size / 2.0);
    const up = glMatrix.vec3.cross(glMatrix.vec3.create(), plane, right);
    const offset = glMatrix.vec3.copy(glMatrix.vec3.create(), plane);
    glMatrix.vec3.scale(offset, offset, plane[3]);

    const p1 = glMatrix.vec3.scaleAndAdd(glMatrix.vec3.create(), offset, right, -1);
    glMatrix.vec3.add(p1, p1, up);

    const p2 = glMatrix.vec3.scaleAndAdd(glMatrix.vec3.create(), offset, right, -1);
    glMatrix.vec3.scaleAndAdd(p2, p2, up, -1);

    const p3 = glMatrix.vec3.add(glMatrix.vec3.create(), offset, right);
    glMatrix.vec3.scaleAndAdd(p3, p3, up, -1);

    const p4 = glMatrix.vec3.add(glMatrix.vec3.create(), offset, right);
    glMatrix.vec3.add(p4, p4, up);

    return [p1, p2, p3, p4];
}

function clipWinding(winding, plane){
    /*Almost a direct port of Quake's algorithm from Quake 2 tools,
    common/polylib.c, ClipWindingEpsilon*/
    const SIDE_BACK = 0;
    const SIDE_FRONT = 1;
    const SIDE_ON = 2;
    let sides = [];
    let dists = [];
    let countF = 0;
    let countB = 0;

    let front = [];
    let frlen = 0;

    let i = 0;
    for(; i < winding.length; ++i){
        let dist = glMatrix.vec3.dot(plane, winding[i]) - plane[3];
        dists[i] = dist;

        if(dist > EPSILON){
            sides[i] = SIDE_FRONT;
            ++countF;
        } else if(dist < -EPSILON){
            sides[i] = SIDE_BACK;
            ++countB;
        } else {
            sides[i] = SIDE_ON;
        }
    }
    sides[i] = sides[0];
    dists[i] = dists[0]; //close the loop to avoid modular arithmetic

    if(countF == 0){
        return null; //no points in front winding, all the points are gone
    }
    if(countB == 0){
        return winding; //no points in the back, return original winding
    }

    for(i = 0; i < winding.length; ++i){
        let p1 = winding[i];
        if(sides[i] == SIDE_ON){
            front[frlen] = glMatrix.vec3.copy(glMatrix.vec3.create(), p1);
            ++frlen;
            continue;
        }

        if(sides[i] == SIDE_FRONT){
            front[frlen] = glMatrix.vec3.copy(glMatrix.vec3.create(), p1);
            ++frlen;
        }

        if(sides[i + 1] == SIDE_ON || sides[i] == sides[i + 1]){
            continue; //if next point is on the plane OR is on same side as current point
        }

        let p2 = winding[(i + 1) % winding.length];
        let t = dists[i] / (dists[i] - dists[i + 1]);

        //let p1p2 = glMatrix.vec3.subtract(glMatrix.vec3.create(), p2, p1);
        //let p3 = glMatrix.vec3.scaleAndAdd(glMatrix.vec3.create(), p1, p1p2, t);

        //this loop does the same as those formulas ^
        //but it prevents floating point inacurracy whenever possible
        let p3 = [0, 0, 0];
        for(let j = 0; j < 3; ++j){
            if(plane[j] == 1)
                p3[j] = plane[3]; //if a plane is nicely axis aligned no need for messy float operations.
            if(plane[j] == -1)
                p3[j] = -plane[3]; //same here
            else
                p3[j] = p1[j] + t * (p2[j] - p1[j]); //plane is not nicely aligned, need for messy float operations.
        }

        front[frlen] = glMatrix.vec3.fromValues(p3[0], p3[1], p3[2]);
        ++frlen;
    }

    return front;
}

const ROUNDING = 128;
const ROUNDING_REC = 1.0 / ROUNDING;
const MAXMAPSIZE = 65536;

function hashKeyVector(p){
    const x = Math.floor(p[0] * ROUNDING);
    const y = Math.floor(p[1] * ROUNDING);
    const z = Math.floor(p[2] * ROUNDING);

    return x.toString(32) + y.toString(32) + z.toString(32);
}

function getVertexIndex(p, n, prevpoint, nextpoint, group, vertexData){
    //const hash = hashKeyVector(p);
    //let entry = vertexData.smooth.get(hash);
    //let shouldAdd = false;

    vertexData.data.push(p[0], p[1], p[2], n[0], n[1], n[2]);
    return vertexData.uniqueVertices++;

    /*if(!entry){
        shouldAdd = true;
        entry = [];
    }

    let selected = null;
    for(let i = 0; i < entry.length; ++i){
        if(!(glMatrix.vec3.exactEquals(prevpoint, entry[i].edge) || glMatrix.vec3.exactEquals(nextpoint, entry[i].edge))) continue;

        const nindex = entry[i].index * 6;
        const normal = [vertexData.data[nindex + 3], vertexData.data[nindex + 4], vertexData.data[nindex + 5]];

        const dot = glMatrix.vec3.dot(normal, n)
        if(dot > 0.7071){
            selected = entry[i];
            break;
        }
    }

    if(!selected){
        entry.push({edge: prevpoint, index: vertexData.uniqueVertices}, {edge: nextpoint, index: vertexData.uniqueVertices});
        vertexData.data.push(p[0], p[1], p[2], n[0], n[1], n[2]);

        if(shouldAdd)
            vertexData.smooth.set(hash, entry);

        return vertexData.uniqueVertices++;
    }

    const nindex = selected.index * 6;
    const curNormal = glMatrix.vec3.fromValues(vertexData.data[nindex + 3], vertexData.data[nindex + 4], vertexData.data[nindex + 5]);
    glMatrix.vec3.add(curNormal, curNormal, n);
    glMatrix.vec3.normalize(curNormal, curNormal);

    vertexData.data[nindex + 3] = curNormal[0]; vertexData.data[nindex + 4] = curNormal[1]; vertexData.data[nindex + 5] = curNormal[2];
    return selected.index;*/
}

function createDisplacement(side, points, vertexData, animation){
    if(points.length != 4)
        return;

    const dispinfo = side.dispInfo;
    const startposition = vmfLib.flipVector(dispinfo.startPosition);
    let startpoint = 0;
    let closestDist = MAXMAPSIZE;

    for(let i = 0; i < points.length; ++i){
        const dist = glMatrix.vec3.squaredDistance(startposition, points[i]);

        if(dist < closestDist){
            startpoint = i;
            closestDist = dist;
        }
    }

    const p1 = points[startpoint];
    const p2 = points[(startpoint + 1) % 4]; //first edge
    const p3 = points[(startpoint + 3) % 4];
    const p4 = points[(startpoint + 2) % 4]; //second edge
    const numVertices = 2**dispinfo.power + 1;
    const numTriangles = numVertices - 1;
    const fract = 1.0 / numTriangles;
    const triTotal = numTriangles*numTriangles*2
    vertexData.dispTriangles += triTotal;

    const indexOffset = vertexData.dispData.length / 6;

    for(let i = 0; i < numVertices; ++i){
        const ip1 = glMatrix.vec3.lerp(glMatrix.vec3.create(), p1, p2, i * fract);
        const ip2 = glMatrix.vec3.lerp(glMatrix.vec3.create(), p3, p4, i * fract);

        for(let j = 0; j < numVertices; ++j){
            const vert = glMatrix.vec3.lerp(glMatrix.vec3.create(), ip1, ip2, j * fract);
            const index = i * numVertices + j;
            const normal = vmfLib.flipVector(dispinfo.normals[index]);
            const offsetNormal = vmfLib.flipVector(dispinfo.offset_normals[index]);
            const offset = vmfLib.flipVector(dispinfo.offsets[index] || [0,0,0]);
            const dist = dispinfo.distances[index];
            glMatrix.vec3.scaleAndAdd(vert, vert, normal, dist);
            glMatrix.vec3.scaleAndAdd(vert, vert, offsetNormal, dispinfo.elevation);
            glMatrix.vec3.add(vert, vert, offset);

            vertexData.dispData.push(vert[0], vert[1], vert[2], 0, 0, 0);
        }
    }

    let flag = true;
    for(let i = 0; i < numTriangles; ++i){
        for(let j = 0; j < numTriangles; ++j){
            const p1 = indexOffset + i * numVertices + j;
            const p2 = indexOffset + (i + 1) * numVertices + j;
            const p3 = indexOffset + (i + 1) * numVertices + j + 1;
            const p4 = indexOffset + i * numVertices + j + 1;

            const v1 = [vertexData.dispData[p1 * 6], vertexData.dispData[p1 * 6 + 1], vertexData.dispData[p1 * 6 + 2]];
            const v2 = [vertexData.dispData[p2 * 6], vertexData.dispData[p2 * 6 + 1], vertexData.dispData[p2 * 6 + 2]];
            const v3 = [vertexData.dispData[p3 * 6], vertexData.dispData[p3 * 6 + 1], vertexData.dispData[p3 * 6 + 2]];
            const v4 = [vertexData.dispData[p4 * 6], vertexData.dispData[p4 * 6 + 1], vertexData.dispData[p4 * 6 + 2]];

            if(flag){
                const edge1 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v2, v3);
                const edge2 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v2, v1);
                const edge3 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v3, v4);
                const edge4 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v3, v1);
                const normal1 = glMatrix.vec3.cross(glMatrix.vec3.create(), edge2, edge1);
                const normal2 = glMatrix.vec3.cross(glMatrix.vec3.create(), edge4, edge3);
                glMatrix.vec3.normalize(normal1, normal1);
                glMatrix.vec3.normalize(normal2, normal2);

                vertexData.dispData[p1 * 6 + 3] += normal1[0]; vertexData.dispData[p1 * 6 + 4] += normal1[1]; vertexData.dispData[p1 * 6 + 5] += normal1[2];
                vertexData.dispData[p2 * 6 + 3] += normal1[0]; vertexData.dispData[p2 * 6 + 4] += normal1[1]; vertexData.dispData[p2 * 6 + 5] += normal1[2];
                vertexData.dispData[p3 * 6 + 3] += normal1[0]; vertexData.dispData[p3 * 6 + 4] += normal1[1]; vertexData.dispData[p3 * 6 + 5] += normal1[2];
                vertexData.dispData[p1 * 6 + 3] += normal2[0]; vertexData.dispData[p1 * 6 + 4] += normal2[1]; vertexData.dispData[p1 * 6 + 5] += normal2[2];
                vertexData.dispData[p3 * 6 + 3] += normal2[0]; vertexData.dispData[p3 * 6 + 4] += normal2[1]; vertexData.dispData[p3 * 6 + 5] += normal2[2];
                vertexData.dispData[p4 * 6 + 3] += normal2[0]; vertexData.dispData[p4 * 6 + 4] += normal2[1]; vertexData.dispData[p4 * 6 + 5] += normal2[2];

                vertexData.displacements.push(p3, p2, p1, p4, p3, p1);
            }
            else{
                const edge1 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v2, v4);
                const edge2 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v2, v1);
                const edge3 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v3, v4);
                const edge4 = glMatrix.vec3.subtract(glMatrix.vec3.create(), v3, v2);
                const normal1 = glMatrix.vec3.cross(glMatrix.vec3.create(), edge2, edge1);
                const normal2 = glMatrix.vec3.cross(glMatrix.vec3.create(), edge4, edge3);
                glMatrix.vec3.normalize(normal1, normal1);
                glMatrix.vec3.normalize(normal2, normal2);

                vertexData.dispData[p1 * 6 + 3] += normal1[0]; vertexData.dispData[p1 * 6 + 4] += normal1[1]; vertexData.dispData[p1 * 6 + 5] += normal1[2];
                vertexData.dispData[p2 * 6 + 3] += normal1[0]; vertexData.dispData[p2 * 6 + 4] += normal1[1]; vertexData.dispData[p2 * 6 + 5] += normal1[2];
                vertexData.dispData[p4 * 6 + 3] += normal1[0]; vertexData.dispData[p4 * 6 + 4] += normal1[1]; vertexData.dispData[p4 * 6 + 5] += normal1[2];
                vertexData.dispData[p2 * 6 + 3] += normal2[0]; vertexData.dispData[p2 * 6 + 4] += normal2[1]; vertexData.dispData[p2 * 6 + 5] += normal2[2];
                vertexData.dispData[p3 * 6 + 3] += normal2[0]; vertexData.dispData[p3 * 6 + 4] += normal2[1]; vertexData.dispData[p3 * 6 + 5] += normal2[2];
                vertexData.dispData[p4 * 6 + 3] += normal2[0]; vertexData.dispData[p4 * 6 + 4] += normal2[1]; vertexData.dispData[p4 * 6 + 5] += normal2[2];

                vertexData.displacements.push(p4, p2, p1, p4, p3, p2);
            }

            animation.push({frametype: "ab", start: -1, add: 1, disp: true});
            animation.push({frametype: "ab", start: -1, add: 1, disp: true});

            flag = !flag;
        }

        flag = !flag;
    }

    //next displacement frame
    animation.push({frametype: "nd"});

    for(let i = indexOffset; i < indexOffset+triTotal; ++i){
        const normal = glMatrix.vec3.fromValues(vertexData.dispData[i * 6 + 3], vertexData.dispData[i * 6 + 4], vertexData.dispData[i * 6 + 5]);
        glMatrix.vec3.normalize(normal, normal);
        vertexData.dispData[i * 6 + 3] = normal[0]; vertexData.dispData[i * 6 + 4] = normal[1]; vertexData.dispData[i * 6 + 5] = normal[2];
    }

    const smooth = (p, normal, index)=>{
        let hash = hashKeyVector(p);
        let entry = vertexData.dispSmooth.get(hash);

        if(!entry){
            entry = {normal: [0, 0, 0], indices: []};
            vertexData.dispSmooth.set(hash, entry);
        }

        glMatrix.vec3.add(entry.normal, entry.normal, normal);
        entry.indices.push(index);
    }

    const off2 = numVertices * (numVertices - 1);
    for(let j = 0; j < numVertices; ++j){
        const ind = (indexOffset + j) * 6;
        const ind2 = (indexOffset + j + off2) * 6;
        const p1 = [vertexData.dispData[ind], vertexData.dispData[ind + 1], vertexData.dispData[ind + 2]];
        const p2 = [vertexData.dispData[ind2], vertexData.dispData[ind2 + 1], vertexData.dispData[ind2 + 2]];
        const n1 = [vertexData.dispData[ind + 3], vertexData.dispData[ind + 4], vertexData.dispData[ind + 5]];
        const n2 = [vertexData.dispData[ind2 + 3], vertexData.dispData[ind2 + 4], vertexData.dispData[ind2 + 5]];

        smooth(p1, n1, ind);
        smooth(p2, n2, ind2);
    }
    for(let j = 1; j < numVertices - 1; ++j){
        let ind = (indexOffset + j * numVertices) * 6;
        let ind2 = (indexOffset + j * numVertices + numVertices - 1) * 6;

        const p1 = [vertexData.dispData[ind], vertexData.dispData[ind + 1], vertexData.dispData[ind + 2]];
        const p2 = [vertexData.dispData[ind2], vertexData.dispData[ind2 + 1], vertexData.dispData[ind2 + 2]];
        const n1 = [vertexData.dispData[ind + 3], vertexData.dispData[ind + 4], vertexData.dispData[ind + 5]];
        const n2 = [vertexData.dispData[ind2 + 3], vertexData.dispData[ind2 + 4], vertexData.dispData[ind2 + 5]];

        smooth(p1, n1, ind);
        smooth(p2, n2, ind2);
    }

    return triTotal;
}

function createSolid_quakemethod(sides, animation, vertexData){
    const colors = [
        [0.831, 0.694, 0.235, 1], [0.769, 0.878, 0.439, 1], [0.831, 0.286, 0.235, 1], [0.796, 0.624, 0.91, 1] 
    ]

    const center = glMatrix.vec3.create();
    let numpoints = 0;
    for(let i = 0; i < sides.length; ++i){
        if(!sides[i].draw) continue;

        const pl1 = sides[i].plane;
        const winding = [];
        let points = baseWinding(sides[i].plane, MAXMAPSIZE / 2);
        animation.push({frametype: "d", data: [{type: "w", data: points}]});

        for(let j = 0; j < sides.length && points; ++j){
            const pl2 = sides[j].plane;
            if(Math.abs(glMatrix.vec3.dot(pl1, pl2)) > 1-EPSILON) continue; //planes are parallel

            points = clipWinding(points, pl2);
            animation.push({frametype: "d", data: [{type: "w", data: points}, {type: "p", data: pl2, color: colors[(i + j) & 3]}]});
        }

        if(!points || points.length < 3) continue; //it shouldn't happen, but just in case :)

        for(let j = 0; j < points.length; ++j){
            points[j][0] = Math.round(points[j][0] * ROUNDING) * ROUNDING_REC;
            points[j][1] = Math.round(points[j][1] * ROUNDING) * ROUNDING_REC;
            points[j][2] = Math.round(points[j][2] * ROUNDING) * ROUNDING_REC;
        }

        if(sides[i].displacement){
            const disptris = createDisplacement(sides[i], points, vertexData, animation);
        } else {
            animation.push({frametype: "ab", start: -1, add: points.length - 2});

            for(let j = 0; j < points.length; ++j){
                const prevpoint = points[(j + points.length - 1) % points.length];
                const nextpoint = points[(j + 1) % points.length];

                winding.push(getVertexIndex(points[j], glMatrix.vec3.negate(glMatrix.vec3.create(), sides[i].plane), prevpoint, nextpoint, 0, vertexData));
            }

            vertexData.windings.push(winding);
            vertexData.windingTriangles += winding.length - 2;
        }

        for(let j = 0; j < points.length; ++j){
            glMatrix.vec3.add(center, center, points[j]);
        }

        numpoints += points.length;
    }

    if(numpoints < 1)
        return;

    glMatrix.vec3.scale(center, center, 1.0/numpoints)
    return center;
}

function indexOfIntersection(i, j, k){
    let temp = i;
    if(i > j){ temp = i; i = j; j = temp;} //sort i, j, k
    if(j > k){ temp = j; j = k; k = temp;}
    if(i > j){ temp = i; i = j; j = temp;}

    return i | j << 8 | k << 16;
}

function indexOfIntersectionStr(i, j, k){
    let temp = i;
    if(i > j){ temp = i; i = j; j = temp;} //sort i, j, k
    if(j > k){ temp = j; j = k; k = temp;}
    if(i > j){ temp = i; i = j; j = temp;}

    return i + " " + j + " " + k;
}

function pointInHull(point, sides){
    for(let i = 0; i < sides.length; ++i){
        if(glMatrix.vec3.dot(point, sides[i].plane) - sides[i].plane[3] < -EPSILON)
            return false;
    }

    return true;
}

function pointOfIntersection2(pl1, pl2, pl3){
    /*Math magic, got it by solving a system of equations:
    A1x + B1y + C1z = D1, A2x + B2y + C2z = D2, A3x + B3y + C3z = D3,
    where ABC are components of a plane normal and D are distances.
    I've seen some code using cross products, it's the same thing, just different form*/
    const det = (pl1[0] * pl2[1] * pl3[2]) + (pl2[0] * pl3[1] * pl1[2]) + (pl3[0] * pl1[1] * pl2[2]) -
    (pl3[0] * pl2[1] * pl1[2]) - (pl1[0] * pl3[1] * pl2[2]) - (pl2[0] * pl1[1] * pl3[2]);

    if(Math.abs(det) < EPSILON) return null;
            // B2 C3 - B3 C2                            B3 C1 - B1 C3                           B1 C2 - B2 C1
    const x = (pl2[1]*pl3[2] - pl3[1]*pl2[2])*pl1[3] + (pl3[1]*pl1[2] - pl1[1]*pl3[2])*pl2[3] + (pl1[1]*pl2[2] - pl2[1]*pl1[2])*pl3[3];
            // A3 C2 - A2 C3                            A1 C3 - A3 C2                           A2 C1 - A1 C2
    const y = (pl3[0]*pl2[2] - pl2[0]*pl3[2])*pl1[3] + (pl1[0]*pl3[2] - pl3[0]*pl1[2])*pl2[3] + (pl2[0]*pl1[2] - pl1[0]*pl2[2])*pl3[3];
            // A2 B3 - A3 B2                            A3 B1 - A1 B3                           A1 B2 - A2 B1
    const z = (pl2[0]*pl3[1] - pl3[0]*pl2[1])*pl1[3] + (pl3[0]*pl1[1] - pl1[0]*pl3[1])*pl2[3] + (pl1[0]*pl2[1] - pl2[0]*pl1[1])*pl3[3];
    const detRec = 1.0 / det;

    return [x * detRec, y * detRec, z * detRec];
}

function pointOfIntersection(pl1, pl2, pl3){
    const cross = glMatrix.vec3.create();

    const det = glMatrix.vec3.dot(pl1, glMatrix.vec3.cross(cross, pl2, pl3));

    if(Math.abs(det) < EPSILON) return null;

    const result = glMatrix.vec3.create();
    glMatrix.vec3.cross(cross, pl2, pl3);
    glMatrix.vec3.scaleAndAdd(result, result, cross, pl1[3]);
    glMatrix.vec3.cross(cross, pl3, pl1);
    glMatrix.vec3.scaleAndAdd(result, result, cross, pl2[3]);
    glMatrix.vec3.cross(cross, pl1, pl2);
    glMatrix.vec3.scaleAndAdd(result, result, cross, pl3[3]);

    const detRec = 1.0 / det;

    return glMatrix.vec3.scale(result, result, detRec);
}

function createSolid_intersectionMethod(sides, animation, vertexData){
    const intMap = new Map(); //intersection hash map for preventing redundant calculations
    const colors = [
        [0.831, 0.694, 0.235, 1], [0.769, 0.878, 0.439, 1], [0.831, 0.286, 0.235, 1], [0.796, 0.624, 0.91, 1] 
    ]

    const shouldAnimate = sides.length < 64; //too many invalid points will be generated!
    const brushCenter = glMatrix.vec3.create();
    let numpoints = 0;

    const intSet = new Set();
    for(let i = 0; i < sides.length; ++i){
        if(!sides[i].draw) continue;

        const center = [0, 0, 0];
        let points = [];
        const invalidPoints = [];

        intSet.clear();

        const pl1 = sides[i].plane;
        for(let j = 0; j < sides.length; ++j){
            const pl2 = sides[j].plane;
            if(Math.abs(glMatrix.vec3.dot(pl1, pl2)) > 1-EPSILON) continue; //planes are parallel

            for(let k = 0; k < sides.length; ++k){
                const pl3 = sides[k].plane;
                if(Math.abs(glMatrix.vec3.dot(pl1, pl3)) > 1-EPSILON || Math.abs(glMatrix.vec3.dot(pl2, pl3)) > 1-EPSILON ) continue; //plane is parallel to p1 or p2

                const intIndex = indexOfIntersection(i, j, k);

                if(intSet.has(intIndex))
                    continue;

                intSet.add(intIndex);

                const intInfo = intMap.get(intIndex);

                let p;
                let valid = false;
                if(!intInfo){
                    p = pointOfIntersection(pl1, pl2, pl3);
                    if(!p) continue;
                    valid = pointInHull(p, sides);
                    p[0] = Math.round(p[0] * ROUNDING) * ROUNDING_REC;
                    p[1] = Math.round(p[1] * ROUNDING) * ROUNDING_REC;
                    p[2] = Math.round(p[2] * ROUNDING) * ROUNDING_REC;

                    intMap.set(intIndex, {point: p, validIntersection: valid});
                } else{
                    p = intInfo.point;
                    valid = intInfo.validIntersection;
                }

                const animData = [{type: "p", data: pl1, color: colors[(i) & 3]}];

                if(valid){
                    points.push(p);
                    center[0] += p[0]; center[1] += p[1]; center[2] += p[2];
                } else {
                    invalidPoints.push(p);
                }

                if(shouldAnimate){
                    for(let np = 0; np < points.length; ++np)
                        animData.push({type: "pt", data: points[np], color: [0, 1, 0, 1]});
                    for(let np = 0; np < invalidPoints.length; ++np)
                        animData.push({type: "pt", data: invalidPoints[np], color: [1, 0, 0, 1]});
                    animation.push({frametype: "d", data: animData});
                }
            }
        }

        if(points.length < 3) continue;

        const pRec = 1.0 / points.length;
        center[0] *= pRec; center[1] *= pRec; center[2] *= pRec;

        //points need to be sorted 
        const tempVector = glMatrix.vec3.create();
        for(let j = 0; j < points.length - 1; ++j){
            const fromcenter = glMatrix.vec3.subtract(glMatrix.vec3.create(), points[j], center);

            let dotMax = Number.MIN_SAFE_INTEGER;
            let smallest = j + 1;

            for(let k = smallest; k < points.length; ++k){
                const fromcenter2 = glMatrix.vec3.subtract(glMatrix.vec3.create(), points[k], center);
                const cross = glMatrix.vec3.dot(pl1, glMatrix.vec3.cross(tempVector, fromcenter, fromcenter2));

                if(cross < EPSILON)
                    continue;

                glMatrix.vec3.normalize(fromcenter2, fromcenter2);
                let dot = glMatrix.vec3.dot(fromcenter2, fromcenter);
                if(dot > dotMax){
                    dotMax = dot;
                    smallest = k;
                }
            }

            const temp = points[j + 1];
            points[j + 1] = points[smallest];
            points[smallest] = temp;
        }

        if(sides[i].displacement){
            createDisplacement(sides[i], points, vertexData, animation);
        } else {
            const winding = [];
            let prevpoint = points[points.length - 1];
            for(let j = 0; j < points.length; ++j){
                const nextpoint = points[(j + 1) % points.length];

                winding.push(getVertexIndex(points[j], glMatrix.vec3.negate(glMatrix.vec3.create(), sides[i].plane), prevpoint, nextpoint, 0, vertexData));
                prevpoint = points[j];
            }

            vertexData.windings.push(winding);
            animation.push({frametype: "ab", start: -1, add: points.length - 2});
            vertexData.windingTriangles += points.length - 2;
        }

        for(let j = 0; j < points.length; ++j){
            glMatrix.vec3.add(brushCenter, brushCenter, points[j]);
        }

        numpoints += points.length;
    }

    if(numpoints < 1)
        return;

    glMatrix.vec3.scale(brushCenter, brushCenter, 1.0/numpoints)
    return brushCenter;
}

function parseFromVmflib(solids, method){
    method = method || 0;

    const vertexData = {smooth: new Map(), data: [], windings: [], dispData: [], displacements: [], dispSmooth: new Map(),
        windingTriangles: 0, dispTriangles: 0, uniqueVertices: 0};
    const animation = [];

    for(const solid of solids){
        const searchFrame = {frametype: "search", solidId: solid.id, animFrame: animation.length, windingTriangles: vertexData.windingTriangles, dispTriangles: vertexData.dispTriangles};
        animation.push(searchFrame);
        for(const side of solid.sides){
            side.plane = planeFromTri(vmfLib.flipVector(side.triangle.p1), vmfLib.flipVector(side.triangle.p2), vmfLib.flipVector(side.triangle.p3));

            if(isNaN(side.plane[0] + side.plane[1] + side.plane[2] + side.plane[3]))
                throw new Error(`Malformed side ${side.id} in solid ${solid.id}!!!`);
            const match = side.material.match(/tools\//);

            side.draw = !match && !(solid.displacement && !side.displacement);
        }

        if(method == 0)
            searchFrame.center = createSolid_quakemethod(solid.sides, animation, vertexData);
        else
            searchFrame.center = createSolid_intersectionMethod(solid.sides, animation, vertexData);
    }

    const buffer = new ArrayBuffer(vertexData.windingTriangles * 72); //84
    let floatView = new Float32Array(buffer);
    let offset = 0;

    //triangulation
    for(let i = 0; i < vertexData.windings.length; ++i){
        const curWinding = vertexData.windings[i];
        for(let j = 0; j < curWinding.length - 2; ++j){
            floatView[offset] = vertexData.data[curWinding[0] * 6];
            floatView[offset + 1] = vertexData.data[curWinding[0] * 6 + 1];
            floatView[offset + 2] = vertexData.data[curWinding[0] * 6 + 2];
            floatView[offset + 3] = vertexData.data[curWinding[0] * 6 + 3];
            floatView[offset + 4] = vertexData.data[curWinding[0] * 6 + 4];
            floatView[offset + 5] = vertexData.data[curWinding[0] * 6 + 5];

            floatView[offset + 6] = vertexData.data[curWinding[j+2] * 6];
            floatView[offset + 7] = vertexData.data[curWinding[j+2] * 6 + 1];
            floatView[offset + 8] = vertexData.data[curWinding[j+2] * 6 + 2];
            floatView[offset + 9] = vertexData.data[curWinding[j+2] * 6 + 3];
            floatView[offset + 10] = vertexData.data[curWinding[j+2] * 6 + 4];
            floatView[offset + 11] = vertexData.data[curWinding[j+2] * 6 + 5];

            floatView[offset + 12] = vertexData.data[curWinding[j+1] * 6];
            floatView[offset + 13] = vertexData.data[curWinding[j+1] * 6 + 1];
            floatView[offset + 14] = vertexData.data[curWinding[j+1] * 6 + 2];
            floatView[offset + 15] = vertexData.data[curWinding[j+1] * 6 + 3];
            floatView[offset + 16] = vertexData.data[curWinding[j+1] * 6 + 4];
            floatView[offset + 17] = vertexData.data[curWinding[j+1] * 6 + 5];
            offset += 18;
        }
    }

    const dispBuffer = new ArrayBuffer(vertexData.dispTriangles * 72);
    floatView = new Float32Array(dispBuffer);
    offset = 0;

    for(const smooth of vertexData.dispSmooth.values()){
        if(smooth.indices.length < 1) continue;

        const normal = glMatrix.vec3.normalize(glMatrix.vec3.create(), smooth.normal);

        for(const ind of smooth.indices){
            vertexData.dispData[ind + 3] = normal[0];
            vertexData.dispData[ind + 4] = normal[1];
            vertexData.dispData[ind + 5] = normal[2];
        }
    }

    for(let i = 0; i < vertexData.dispTriangles; ++i){
        floatView[offset] = vertexData.dispData[vertexData.displacements[i * 3] * 6];
        floatView[offset + 1] = vertexData.dispData[vertexData.displacements[i * 3] * 6 + 1];
        floatView[offset + 2] = vertexData.dispData[vertexData.displacements[i * 3] * 6 + 2];
        floatView[offset + 3] = vertexData.dispData[vertexData.displacements[i * 3] * 6 + 3];
        floatView[offset + 4] = vertexData.dispData[vertexData.displacements[i * 3] * 6 + 4];
        floatView[offset + 5] = vertexData.dispData[vertexData.displacements[i * 3] * 6 + 5];

        floatView[offset + 6] = vertexData.dispData[vertexData.displacements[i * 3 + 1] * 6];
        floatView[offset + 7] = vertexData.dispData[vertexData.displacements[i * 3 + 1] * 6 + 1];
        floatView[offset + 8] = vertexData.dispData[vertexData.displacements[i * 3 + 1] * 6 + 2];
        floatView[offset + 9] = vertexData.dispData[vertexData.displacements[i * 3 + 1] * 6 + 3];
        floatView[offset + 10] = vertexData.dispData[vertexData.displacements[i * 3 + 1] * 6 + 4];
        floatView[offset + 11] = vertexData.dispData[vertexData.displacements[i * 3 + 1] * 6 + 5];

        floatView[offset + 12] = vertexData.dispData[vertexData.displacements[i * 3 + 2] * 6];
        floatView[offset + 13] = vertexData.dispData[vertexData.displacements[i * 3 + 2] * 6 + 1];
        floatView[offset + 14] = vertexData.dispData[vertexData.displacements[i * 3 + 2] * 6 + 2];
        floatView[offset + 15] = vertexData.dispData[vertexData.displacements[i * 3 + 2] * 6 + 3];
        floatView[offset + 16] = vertexData.dispData[vertexData.displacements[i * 3 + 2] * 6 + 4];
        floatView[offset + 17] = vertexData.dispData[vertexData.displacements[i * 3 + 2] * 6 + 5];

        offset += 18;
    }

    animation.push({frametype: "ab", start: vertexData.windingTriangles, add: 0});
    animation.push({frametype: "ab", start: vertexData.dispTriangles, add: 0, disp: true});

    return {data: buffer, dispData: dispBuffer, numTriangles: vertexData.windingTriangles, 
        numDispTriangles: vertexData.dispTriangles, animation: animation};
}