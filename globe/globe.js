/**
 * dat.globe Javascript WebGL Globe Toolkit
 * http://dataarts.github.com/dat.globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container) {

  colorFn = function(relationship) {
    var c = new THREE.Color();
    switch (relationship) {
      case 'friend':
        c.setRGB(1.0, 0.1, 0.0);
        break;
      case 'everyone':
        c.setRGB(0.99, 0.7, 0.0);
        break;
      case 'me':
        c.setRGB(1.0, 0.0, 1.0);
    }
    return c;
  };

  Shaders = {
    'earth': {
      uniforms: {
        'texture': {
          type: 't',
          value: 0,
          texture: null
        }
      },
      vertexShader: [
          'varying vec3 vNormal;',
          'varying vec2 vUv;',
          'void main() {',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          'vNormal = normalize( normalMatrix * normal );',
          'vUv = uv;',
          '}'
      ].join('\n'),
      fragmentShader: [
          'uniform sampler2D texture;',
          'varying vec3 vNormal;',
          'varying vec2 vUv;',
          'void main() {',
          'vec3 diffuse = texture2D( texture, vUv ).xyz;',
          'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
          'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
          'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
          '}'
      ].join('\n')
    },
    'atmosphere': {
      uniforms: {},
      vertexShader: [
          'varying vec3 vNormal;',
          'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          '}'
      ].join('\n'),
      fragmentShader: [
          'varying vec3 vNormal;',
          'void main() {',
          'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
          'gl_FragColor = vec4( 0.33, 0.11, 0.44, 1.0 ) * intensity;',
          '}'
      ].join('\n')
    },
    'contributor': {
      uniforms: {},
      vertexShader: [
          'varying vec3 vNormal;',
          'void main() {',
          'vNormal = normalize( normalMatrix * normal );',
          'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
          '}'
      ].join('\n'),
      fragmentShader: [
          'varying vec3 vNormal;',
          'void main() {',
          'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
          'gl_FragColor = vec4( 0.33, 0.11, 0.44, 1.0 ) * intensity;',
          '}'
      ].join('\n')
    },
  };

  var camera, scene, material, sceneAtmosphere, renderer, w, h;
  var vector, mesh, atmosphere, point;

  var overRenderer;
  var myColor = 0xff0000;
  var friendColor = 0x0000ff;
  var everyoneColor = 0x00ff00;
  var highlightColor = 0xFF00FF;

  var imgDir = '/globe/';

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

  var mouse = {
    x: 0,
    y: 0
  }, mouseOnDown = {
      x: 0,
      y: 0
    };
  var rotation = {
    x: 0,
    y: 0
  },
    target = {
      x: Math.PI * 3 / 2,
      y: Math.PI / 6.0
    },
    targetOnDown = {
      x: 0,
      y: 0
    };

  var distance = 100000,
    distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

  function init() {

    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    camera = new THREE.Camera(
      30, w / h, 1, 10000);
    camera.position.z = distance;

    vector = new THREE.Vector3();

    scene = new THREE.Scene();
    sceneAtmosphere = new THREE.Scene();

    //******EARTH SETUP**********
    var geometry = new THREE.Sphere(200, 40, 30);

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms['texture'].texture = THREE.ImageUtils.loadTexture(imgDir + 'world' +
      '.jpg');

    material = new THREE.MeshShaderMaterial({

      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader

    });

    mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    scene.addObject(mesh);

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.MeshShaderMaterial({

      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader

    });

    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.1;
    mesh.flipSided = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    sceneAtmosphere.addObject(mesh);


    //********POINT SETUP*********************
    geometry = new THREE.Cube(0.75, 0.75, 1, 1, 1, 1, null, false, {
      px: true,
      nx: true,
      py: true,
      ny: true,
      pz: false,
      nz: true
    });

    for (var i = 0; i < geometry.vertices.length; i++) {
      var vertex = geometry.vertices[i];
      vertex.position.z += 0.5;
    }

    point = new THREE.Mesh(geometry);
    renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    renderer.autoClear = false;
    renderer.setClearColorHex(0x000000, 0.0);
    renderer.setSize(w, h);
    renderer.domElement.style.position = 'absolute';
    container.appendChild(renderer.domElement);
    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mousewheel', onMouseWheel, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);
    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);
  }

  //Where we add to globe based on json data which contains lat and long
  addData = function(data, opts) {
    var lat, lng, size, color, i, step, colorFnWrapper;

    opts.format = opts.format || 'magnitude'; // other option is 'legend'
    console.log(opts.format);
    if (opts.format === 'magnitude') {
      step = 3;
      colorFnWrapper = function(data, relationship) {
        return colorFn(relationship);
      }
    } else {
      throw ('error: format not supported: ' + opts.format);
    }

    var everyoneElseGeometry = new THREE.Geometry();
    var myGeometry = new THREE.Geometry();
    var friendGeometry = new THREE.Geometry();
    for (i = 0; i < data.length; i += step) {
      //hack to stimulate friends or everyone
      var relationship = '';
      i === 0 ? relationship = 'me' : i < data.length / 4 ? relationship = 'friend' : relationship = 'everyone'
      lat = data[i];
      lng = data[i + 1];
      color = colorFnWrapper(data, relationship);
      size = data[i + 2];
      size = size * 200;
      switch (relationship) {
        case 'friend':
          addPoint(lat, lng, size, color, friendGeometry);
          break;
        case 'everyone':
          addPoint(lat, lng, size, color, everyoneElseGeometry);
          break;
        case 'me':
          addPoint(lat, lng, size, color, myGeometry);
      }
      addPoint(lat, lng, size, color, everyoneElseGeometry);
    }
    this._everyoneElseGeometry = everyoneElseGeometry;
    this._friendGeometry = friendGeometry;
    this._myGeometry = myGeometry;

  };

  function updatePoints(view) {
    if(view === 'whoEveryone'){
      this.everyoneElsePoints.materials[0].color.setHex(this.highlightColor);
      this.friendPoints.materials[0].color.setHex(this.highlightColor);
      this.myPoints.materials[0].color.setHex(this.highlightColor);

    }

    if(view === 'whoMe'){
      this.myPoints.materials[0].color.setHex(this.highlightColor);
      this.everyoneElsePoints.materials[0].color.setHex(this.everyoneColor);
      this.friendPoints.materials[0].color.setHex(this.friendColor);
    }

    if(view === 'whoFriends'){
      this.friendPoints.materials[0].color.setHex(this.highlightColor);
      this.myPoints.materials[0].color.setHex(this.myColor);
      this.everyoneElsePoints.materials[0].color.setHex(this.everyoneColor);
    }

  };

  function createPoints() {
    if (this._everyoneElseGeometry !== undefined) {
      this.everyoneElsePoints = new THREE.Mesh(this._everyoneElseGeometry, new THREE.MeshBasicMaterial({
        color: this.everyoneColor
      }));
      }
      if (this._friendGeometry !== undefined) {
        this.friendPoints = new THREE.Mesh(this._friendGeometry, new THREE.MeshBasicMaterial({
          color: this.friendColor
        }));
      }
      if (this._myGeometry !== undefined) {
        this.myPoints = new THREE.Mesh(this._myGeometry, new THREE.MeshBasicMaterial({
          color: this.myColor
        }));
      }

      scene.addObject(this.everyoneElsePoints);
      scene.addObject(this.friendPoints);
      scene.addObject(this.myPoints);
    }

    function addPoint(lat, lng, size, color, subgeo) {
      var phi = (90 - lat) * Math.PI / 180;
      var theta = (180 - lng) * Math.PI / 180;

      point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
      point.position.y = 200 * Math.cos(phi);
      point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

      point.lookAt(mesh.position);

      point.scale.z = -size;
      point.updateMatrix();

      var i;
      for (i = 0; i < point.geometry.faces.length; i++) {
        point.geometry.faces[i].color = color;
      }
      GeometryUtils.merge(subgeo, point);
    }

    function animate() {
      requestAnimationFrame(animate);
      render();
    }

    function render() {
      zoom(curZoomSpeed);

      rotation.x += (target.x - rotation.x) * 0.1;
      rotation.y += (target.y - rotation.y) * 0.1;
      distance += (distanceTarget - distance) * 0.3;

      camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
      camera.position.y = distance * Math.sin(rotation.y);
      camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

      vector.copy(camera.position);

      renderer.clear();
      renderer.render(scene, camera);
      renderer.render(sceneAtmosphere, camera);
    }

    init();
    this.animate = animate;

    this.addData = addData;
    this.createPoints = createPoints;
    this.updatePoints = updatePoints;
    this.renderer = renderer;
    this.scene = scene;
    this.myColor = myColor;
    this.friendColor = friendColor;
    this.everyoneColor = everyoneColor;
    this.highlightColor = highlightColor;

    //*********MOUSE HANDLER STUFF******************

    function onMouseDown(event) {
      event.preventDefault();

      container.addEventListener('mousemove', onMouseMove, false);
      container.addEventListener('mouseup', onMouseUp, false);
      container.addEventListener('mouseout', onMouseOut, false);

      mouseOnDown.x = -event.clientX;
      mouseOnDown.y = event.clientY;

      targetOnDown.x = target.x;
      targetOnDown.y = target.y;

      container.style.cursor = 'move';
    }

    function onMouseMove(event) {
      mouse.x = -event.clientX;
      mouse.y = event.clientY;

      var zoomDamp = distance / 1000;

      target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
      target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

      target.y = target.y > PI_HALF ? PI_HALF : target.y;
      target.y = target.y < -PI_HALF ? -PI_HALF : target.y;
    }

    function onMouseUp(event) {
      container.removeEventListener('mousemove', onMouseMove, false);
      container.removeEventListener('mouseup', onMouseUp, false);
      container.removeEventListener('mouseout', onMouseOut, false);
      container.style.cursor = 'auto';
    }

    function onMouseOut(event) {
      container.removeEventListener('mousemove', onMouseMove, false);
      container.removeEventListener('mouseup', onMouseUp, false);
      container.removeEventListener('mouseout', onMouseOut, false);
    }

    function onMouseWheel(event) {
      event.preventDefault();
      if (overRenderer) {
        zoom(event.wheelDeltaY * 0.3);
      }
      return false;
    }

    function onDocumentKeyDown(event) {
      switch (event.keyCode) {
        case 38:
          zoom(100);
          event.preventDefault();
          break;
        case 40:
          zoom(-100);
          event.preventDefault();
          break;
      }
    }

    function onWindowResize(event) {
      console.log('resize');
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function zoom(delta) {
      distanceTarget -= delta;
      distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
      distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
    }

    return this;

  };