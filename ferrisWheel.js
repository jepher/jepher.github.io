"use strict";

var gl;
var program;

var objects = [];
var objPositions = [];
var objNormals = [];
var objTexcoords = [];

var selectedCar = 0;
var thetaLoc;

const downscale = 10;
const numCars = 20;
const baseIndex = 0;
const wheelIndex = 1;
const carTopIndex = 5;
const rotationSpeed = 1.0;

function GeometryObject(){
  this.positions = [];
  this.normals = [];
  this.colors = [];
  this.theta = [0, 0, 0];
}

GeometryObject.prototype.bindBuffers = function() {
    this.cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.colors), gl.STATIC_DRAW);

    this.vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positions), gl.STATIC_DRAW);
}

GeometryObject.prototype.loadBuffer = function() {
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(this.colors), gl.STATIC_DRAW);

  var colorLoc = gl.getAttribLocation( program, "aColor" );
  gl.vertexAttribPointer( colorLoc, 4, gl.FLOAT, false, 0, 0 );
  gl.enableVertexAttribArray( colorLoc );

  gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(this.positions), gl.STATIC_DRAW);

  var positionLoc = gl.getAttribLocation(program, "aPosition");
  gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLoc);
}

GeometryObject.prototype.getCenter = function() {
  var center = [0, 0, 0];
  this.positions.forEach((position) => {
    for(var i = 0; i < 3; i += 1){
      center[i] += position[i];
    }
  })
  for(var i = 0; i < 3; i += 1){
    center[i] /= this.positions.length;
  }

  return center;
}

function loadOBJ(src, separateObjects) {
  objPositions = [];
  objNormals = [];
  objTexcoords = [];
 
  return new Promise(function (resolve) {
    var xhr = new XMLHttpRequest()
    xhr.onreadystatechange = function () {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        if(separateObjects){
          resolve(parseOBJs(xhr.responseText, separateObjects))
        }
        else{
          resolve(parseOBJ(xhr.responseText, separateObjects))
        }
      }
    }
    xhr.open('GET', src, true)
    xhr.send(null)
  })
}

function parseOBJs(text) {
  var currentObjString = '';
  var geomObjs = [];
  const OBJ = /^o\s/
  var lines = text.split('\n');
  lines.forEach((line) => {
    if (OBJ.exec(line) != null) {
      if(currentObjString.length > 0)
        geomObjs.push(parseOBJ(currentObjString));

      currentObjString = '';
    } else {
      currentObjString += line + '\n';
    }
  })

  if(currentObjString.length > 0)
    geomObjs.push(parseOBJ(currentObjString));

  return geomObjs;
}

function parseOBJ(text) {
  var geomObj = new GeometryObject();
  const POSITION = /^v\s+([\d\.\+\-eE]+)\s+([\d\.\+\-eE]+)\s+([\d\.\+\-eE]+)/
  const NORMAL = /^vn\s+([\d\.\+\-eE]+)\s+([\d\.\+\-eE]+)\s+([\d\.\+\-eE]+)/
  const TEXCOORD = /^vt\s+([\d\.\+\-eE]+)\s+([\d\.\+\-eE]+)/
  const FACE = /^f\s/

  var objVertexData = [
    objPositions,
    objTexcoords,
    objNormals
  ];

  var webglVertexData = [
    geomObj.positions,
    geomObj.colors,   
    geomObj.normals
  ];

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      const objIndex = parseInt(objIndexStr);
      if(i == 1){
        geomObj.colors.push(vec4(1.0, 0.0, 0.0, 1.0));
      }
      else if(!isNaN(objIndex)){
        webglVertexData[i].push(objVertexData[i][objIndex - 1]);
      }
    });
  }

  var lines = text.split('\n');
  lines.forEach((line) => {
    // Match each line of the file against various RegEx-es
    var result;
    if ((result = POSITION.exec(line)) != null) {
      // Add new vertex position
      objPositions.push(vec4(parseFloat(result[1]) / downscale, (parseFloat(result[2]) - 7) / downscale, parseFloat(result[3]) / downscale, 1.0))
    } else if ((result = NORMAL.exec(line)) != null) {
      // Add new vertex normal
      objNormals.push(vec3(parseFloat(result[1]), parseFloat(result[2]), parseFloat(result[3])))
    } else if ((result = TEXCOORD.exec(line)) != null) {
      // Add new texture mapping point
      objTexcoords.push(vec2(parseFloat(result[1]), 1 - parseFloat(result[2])))
    } else if ((result = FACE.exec(line)) != null) {
      var vertexStrings = result.input.split(' ');
      vertexStrings.splice(0, 1);
      // Add new face
      const numTriangles = vertexStrings.length - 2;
      for (let i = 0; i < numTriangles; ++i) {
        addVertex(vertexStrings[0]);
        addVertex(vertexStrings[i + 1]);
        addVertex(vertexStrings[i + 2]);
      }
    }
  })
  // console.log(geomObj);
  geomObj.bindBuffers();
  return geomObj;
}

function render()
{
  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  objects.forEach((object) =>{
    object.loadBuffer();

    gl.uniform3fv(thetaLoc, object.theta);

    gl.drawArrays(gl.TRIANGLES, 0, object.positions.length);
  })

  objects[wheelIndex].theta[2] = (objects[wheelIndex].theta[2] + rotationSpeed) % 360;

  for(var i = wheelIndex + 1; i < objects.length; i++){
    var top = objects[i].positions[carTopIndex];
    var radius = Math.sqrt(Math.pow(top[0], 2) + Math.pow(top[1], 2)); 
    var angle = Math.acos(top[0] / radius);
    if(top[1] < 0){
      angle = 2 * Math.PI - angle;
    }
    angle += rotationSpeed * (Math.PI / 180);
    var newTop = vec4(radius * Math.cos(angle), radius * Math.sin(angle), top[2], 1.0);
    var translationVector = [newTop[0] - top[0], newTop[1] - top[1]];
    for(var j = 0; j < objects[i].positions.length; j++){
      var vertex = objects[i].positions[j];
      objects[i].positions[j] = vec4(vertex[0] + translationVector[0], vertex[1] + translationVector[1], vertex[2], 1.0);
    }
  }

  var carIndex = wheelIndex + 1 + selectedCar;
  var top = objects[carIndex].positions[carTopIndex];
  for(var i = 0; i < objects[carIndex].positions.length; i++){
    var vertex = objects[carIndex].positions[i];
    var translated = vec4(vertex[0] - top[0], vertex[1] - top[1], vertex[2] - top[2], 1.0);
    var rotationAngleRad = (2 * rotationSpeed) * (Math.PI / 180);
    var rotated = vec4(translated[0] * Math.cos(rotationAngleRad) - translated[1] * Math.sin(rotationAngleRad), 
                        translated[0] * Math.sin(rotationAngleRad) + translated[1] * Math.cos(rotationAngleRad),
                        translated[2], 
                        translated[3]);
    objects[carIndex].positions[i] = vec4(rotated[0] + top[0], rotated[1] + top[1], rotated[2] + top[2], 1.0);
  }
  
//   setTimeout(
//     function () {requestAnimationFrame(render);},
//     200
// );
  requestAnimationFrame(render);
}

window.onload = async function init()
{
    var canvas = document.getElementById("gl-canvas");

    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");
    gl.enable(gl.DEPTH_TEST)
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // Load shaders and initialize attribute buffers
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram( program );
    thetaLoc = gl.getUniformLocation(program, "uTheta");

    objects.push(await loadOBJ('./models/wheel_base.obj', false));
    objects.push(await loadOBJ('./models/wheel_skeleton.obj', false));
    objects.push(...(await loadOBJ('./models/wheel_car.obj', true)));

    // translate objects to center ferris wheel on screen
    var center = objects[wheelIndex].getCenter();
    objects.forEach((object) => {
      for(var i = 0; i < object.positions.length; i += 1){
        object.positions[i][1] -= center[1];
      }
    })

    // color selected car
    for(var i = 0; i < objects[wheelIndex + 1 + selectedCar].colors.length; i += 1){
      objects[wheelIndex + 1 + selectedCar].colors[i] = vec4(0.0, 0.0, 1.0, 1.0);
    }

    // render loop
    render();

    // Initialize event handlers
    document.getElementById("prevCar").onclick = function(event) {
      var oldSelectedCar = selectedCar;
      selectedCar = (selectedCar - 1) % numCars;
      handleCarChange(oldSelectedCar, selectedCar)
    };

    document.getElementById("nextCar").onclick = function(event) {
        var oldSelectedCar = selectedCar;
        selectedCar = (selectedCar + 1) % numCars;
        handleCarChange(oldSelectedCar, selectedCar)
    };
};

function handleCarChange(oldSelectedCar, newSelectedCar) {
  for(var i = 0; i < objects[wheelIndex + 1 + newSelectedCar].colors.length; i += 1){
    objects[wheelIndex + 1 + newSelectedCar].colors[i] = vec4(0.0, 0.0, 1.0, 1.0);
  }

  for(var i = 0; i < objects[wheelIndex + 1 + oldSelectedCar].colors.length; i += 1){
    objects[wheelIndex + 1 + oldSelectedCar].colors[i] = vec4(1.0, 0.0, 0.0, 1.0);
  }
}