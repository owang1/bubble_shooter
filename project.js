"use strict";

var gl;

var radius;
var side_length;

var vertices = [];
var colors = [];
var textureCoordData = [];

var a_vPositionLoc;
var u_fColorLoc;
var u_ctMatrixLoc;
var a_TextureCoordLoc;
var u_TextureSamplerLoc;
var u_optionLoc;

var vBuffer;
var tBuffer;

var rows;
var existing_bubbles = [];
var bubble_colors = [];
var visited = [];
var num_existing_bubbles;
var cluster;
var temp_i;
var bursted;
var pops;
var new_row_freq;

var shooting;
var shooter_angle;
var shooter_bubble_x;
var shooter_bubble_y;
var v_x;
var v_y;

var color_index;
var shooter_bubble_color;

var red_texture, yellow_texture, blue_texture, shooter_texture;
var texCoord = [
    vec2(0, 0),
    vec2(0, 1),
    vec2(1, 1),
    vec2(1, 0)
];

var started;
var start_time;
var paused;
var paused_time;
var start_pause_time;
var paused_seconds;
var seconds;
var total_seconds;
var remaining_time;

function initTextures() {
    red_texture = gl.createTexture();
    red_texture.image = new Image();
    red_texture.image.onload = function() {
        handleLoadedTexture(red_texture)
    }
    red_texture.image.src = "./images/smile.jpg";

    yellow_texture = gl.createTexture();
    yellow_texture.image = new Image();
    yellow_texture.image.onload = function() {
        handleLoadedTexture(yellow_texture)
    }
    yellow_texture.image.src = "./images/wink.jpg";

    blue_texture = gl.createTexture();
    blue_texture.image = new Image();
    blue_texture.image.onload = function() {
        handleLoadedTexture(blue_texture)
    }
    blue_texture.image.src = "./images/frown.jpg";

    shooter_texture = gl.createTexture();
    shooter_texture.image = new Image();
    shooter_texture.image.onload = function() {
        handleLoadedTexture(shooter_texture)
    }
    shooter_texture.image.src = "./images/cannon.jpg";
}

function handleLoadedTexture(texture) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
}

window.onload = function init() {
    var canvas = document.getElementById("gl-canvas");

    document.getElementById("level-form").reset();
    document.getElementById("color-form").reset();

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    // Circle for all bubbles
    radius = 0.05;
    var theta, x, y;
    vertices.push(vec3(0.0, 0.0, 0.0));
    var s = 0.0 * 10 + 0.5;
    var t = 0.0 * 10 + 0.5;
    textureCoordData.push(s);
    textureCoordData.push(t);

    for (var i = 0; i <= 36; i++) {
        theta = i * 2 * Math.PI / 36;
        x = radius * Math.cos(theta);
        y = radius * Math.sin(theta);
        vertices.push(vec3(x, y, 0.0));
        s = x * 10 + 0.5;
        t = y * 10 + 0.5;
        textureCoordData.push(s);
        textureCoordData.push(t);
    }

    // Rectangle for cannon
    side_length = 0.05;
    vertices.push(
        vec3(-side_length / 2, -side_length / 2, 0.0),
        vec3(-side_length / 2, side_length / 2, 0.0),
        vec3(side_length / 2, side_length / 2, 0.0),
        vec3(side_length / 2, -side_length / 2, 0.0)
    );
    textureCoordData.push(0.0);
    textureCoordData.push(0.0);
    textureCoordData.push(0.0);
    textureCoordData.push(1.0);
    textureCoordData.push(1.0);
    textureCoordData.push(1.0);
    textureCoordData.push(1.0);
    textureCoordData.push(0.0);

    // All 3 color schemes: default, ND, USA
    colors = [
        /*Default*/
        vec3(1.0, 0, 0),                    // red
        vec3(1.0, 1.0, 0),                  // yellow
        vec3(0, 0, 1.0),                    // blue
        /*ND*/
        vec3(0.047, 0.137, 0.251),          // blue
        vec3(0.788, 0.592, 0),              // gold
        vec3(0.039, 0.525, 0.239),          // green
        /*USA*/
        vec3(0.235, 0.231, 0.431),          // red
        vec3(1, 1, 1),                      // white
        vec3(0.698, 0.133, 0.204)           // blue
    ];

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    a_vPositionLoc = gl.getAttribLocation(program, "a_vPosition");
    gl.vertexAttribPointer(a_vPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_vPositionLoc);

    u_fColorLoc = gl.getUniformLocation(program, "u_fColor");
    u_ctMatrixLoc = gl.getUniformLocation(program, "u_ctMatrix");
    a_TextureCoordLoc = gl.getAttribLocation(program, "a_TextureCoord");
    u_TextureSamplerLoc = gl.getUniformLocation(program, "u_TextureSampler");
    u_optionLoc = gl.getUniformLocation(program, "u_option");

    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordData), gl.STATIC_DRAW);

    // Initially create data for offset rows of randomly-colored bubbles
    rows = 10;
    var center_x, center_y, color;
    for (var i = 0; i < rows; i++) {
        if (i % 2 == 0) {
            for (var j = 0; j < 20; j++) {
                center_x = -1.0 + radius * (2 * j + 1);
                center_x = Math.round(center_x * 100) / 100;
                center_y = 1.0 - radius * (2 * i + 1);
                center_y = Math.round(center_y * 100) / 100;
                existing_bubbles.push(vec3(center_x, center_y, 0.0));
                color = Math.floor(Math.random() * 3);
                bubble_colors.push(colors[color]);
            }
        }
        else {
            for (var j = 0; j < 19; j++) {            // Every other row is offset by the radius, .05
                center_x = -1.0 + radius * (2 * j + 2);
                center_x = Math.round(center_x * 100) / 100;
                center_y = 1.0 - radius * (2 * i + 1);
                center_y = Math.round(center_y * 100) / 100;
                existing_bubbles.push(vec3(center_x, center_y, 0.0));
                color = Math.floor(Math.random() * 3);
                bubble_colors.push(colors[color]);
            }
        }
    }

    pops = 0;
    new_row_freq = 30;

    // Initialize variables for shooter bubbles
    shooting = false;
    shooter_angle = 0;
    shooter_bubble_x = Math.cos(radians(shooter_angle + 90));
    shooter_bubble_y = (side_length*4 + radius) * Math.sin(radians(shooter_angle + 90)) - 0.8;
    v_x = 0.01 * Math.cos(radians(shooter_angle + 90));
    v_y = 0.01 * Math.sin(radians(shooter_angle + 90));

    color_index = 0;
    shooter_bubble_color = colors[Math.floor(Math.random() * 3)];

    initTextures();

    started = false;
    document.getElementById("start-button").onclick = function() {
        choose_level();
        start_time = new Date().getTime();
        document.getElementById("start-button").disabled = true;
        started = true;
    }
    paused = false;
    paused_time = 0;
    total_seconds = 120;

    var x = setInterval(add_new_row, 1000);

    render();
}

// Pause the game
function pause() {
    var change = document.getElementById("pause-button");
    if (change.innerHTML == "Pause") {
        change.innerHTML = "Play";
        paused = true;
        start_pause_time = new Date().getTime();
    }
    else {
        change.innerHTML = "Pause";
        paused = false;
        var now = new Date().getTime();
        var paused_time = now - start_pause_time;
        paused_seconds = Math.floor(paused_time / 1000);
        total_seconds += paused_seconds;
    }
}

// Choose the difficulty level, changing number of initial rows
function choose_level() {
    if (document.getElementById("easy").checked)
        rows = 2;
    else if (document.getElementById("medium").checked)
        rows = 6;
    else if (document.getElementById("hard").checked)
        rows = 10;

    var lower_limit = 0.95 - rows * 0.1;
    lower_limit = Math.round(lower_limit * 100) / 100;
    for (var i = 0; i < existing_bubbles.length; i++) {
        if (existing_bubbles[i][1] <= lower_limit) {
            existing_bubbles.splice(i, 1);
            bubble_colors.splice(i, 1);
            i--;
        }
    }
}

// Choose your bubble color scheme
function choose_colors() {
    var old_color_index = color_index;

    if (document.getElementById("default").checked)
        color_index = 0;
    else if (document.getElementById("nd").checked)
        color_index = 3;
    else if (document.getElementById("usa").checked)
        color_index = 6;

    if (old_color_index != color_index) {
        // For loop to loop through all the top bubbles
        for (var i = 0; i < bubble_colors.length; i++) {
            var old_color = bubble_colors[i];
            var old_index = (colors.indexOf(old_color))%3;
            bubble_colors[i] = colors[color_index + old_index];
        }
        // Change shooter color
        var old_shooter_color = (colors.indexOf(shooter_bubble_color))%3;
        shooter_bubble_color = colors[old_shooter_color + color_index];
    }
}

// Apply transformations to all existing bubbles at top of the screen
function draw_existing_bubbles() {
    var center_x, center_y;
    var outerMat;
    var pm = ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);

    for (var i = 0; i < existing_bubbles.length; i++) {
        center_x = existing_bubbles[i][0];
        center_y = existing_bubbles[i][1];
        outerMat = mult(translate(center_x, center_y, 0.0), scalem(1.0, 1.0, 1.0));
        outerMat = mult(pm, outerMat);

        gl.uniformMatrix4fv(u_ctMatrixLoc, false, flatten(outerMat));

        draw_bubble(bubble_colors[i]);
    }
}

// Draw and texture a single bubble based on the given color
function draw_bubble(color) {
    var texture;

    gl.uniform3fv(u_fColorLoc, color);

    if ((colors.indexOf(color) % 3 == 0))
        texture = red_texture;
    else if ((colors.indexOf(color)) % 3 == 1)
        texture = yellow_texture;
    else
        texture = blue_texture;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(u_TextureSamplerLoc, 0);

    gl.uniform1f(u_optionLoc, 0.0);

    gl.enableVertexAttribArray(a_vPositionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.vertexAttribPointer(a_vPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 38);

    gl.enableVertexAttribArray(a_TextureCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.vertexAttribPointer(a_TextureCoordLoc, 2, gl.FLOAT, false, 0, 0);
}

// Draw shooter cannon and bubble
function draw_shooter() {
    // Simple rectangle for shooter (black cannon)
    var outerMat;
    var pm = ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
    var tm = translate(0, -.8, 0);
    var rm = rotateZ(shooter_angle);
    var texture;

    outerMat = scalem(3.0, 6.0, 2.0);
    outerMat = mult(rm, outerMat);
    outerMat = mult(tm, outerMat);
    outerMat = mult(pm, outerMat);

    gl.uniformMatrix4fv(u_ctMatrixLoc, false, flatten(outerMat));

    gl.uniform3fv(u_fColorLoc, vec3(0.0, 0.0, 0.0));

    texture = shooter_texture;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(u_TextureSamplerLoc, 0);

    gl.uniform1f(u_optionLoc, 1.0);

    gl.enableVertexAttribArray(a_vPositionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.vertexAttribPointer(a_vPositionLoc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays( gl.TRIANGLE_FAN, 38, 4 );

    gl.enableVertexAttribArray(a_TextureCoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.vertexAttribPointer(a_TextureCoordLoc, 2, gl.FLOAT, false, 0, 0);

    // Draw shooter bubble
    if (!shooting) {
        pm = ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
        // Translate upwards
        tm = translate(0, side_length*4 + radius , 0);
        rm = rotateZ(shooter_angle);

        outerMat = scalem(1.0, 1.0, 1.0);
        outerMat = mult(tm, outerMat);
        outerMat = mult(rm, outerMat);
        // Translate downwards
        tm = translate(0, -.8, 0);
        outerMat = mult(tm, outerMat);
        outerMat = mult(pm, outerMat);

        gl.uniformMatrix4fv(u_ctMatrixLoc, false, flatten(outerMat));

        draw_bubble(shooter_bubble_color);
    }
}

// Change the cannon and bubble angle depending on arrow key presses, then shoot with spacebar
function change_shooter_direction() {
    // Get keyboard press (arrows left or right)
    document.onkeydown = checkKey;

    function checkKey(e) {

        e = e || window.event;

        if (e.keyCode == '37') {
            // Left arrow
            // Rotate the cannon and bubble left within 45 degree range
            if (shooter_angle <= 45 && !shooting && started && !paused) {
                shooter_angle += 5;
                shooter_bubble_x = (side_length*4 + radius)*Math.cos(radians(shooter_angle + 90));
                shooter_bubble_y = (side_length*4 + radius) * Math.sin(radians(shooter_angle + 90)) - 0.8;
                v_x = 0.01 * Math.cos(radians(shooter_angle + 90));
                v_y = 0.01 * Math.sin(radians(shooter_angle + 90));
            }
        }
        else if (e.keyCode == '39') {
            // Right arrow
            if (shooter_angle >= -45 && !shooting && started && !paused) {
                shooter_angle -= 5;
                shooter_bubble_x = (side_length*4 + radius)*Math.cos(radians(shooter_angle + 90));
                shooter_bubble_y = (side_length*4 + radius) * Math.sin(radians(shooter_angle + 90)) - 0.8;
                v_x = 0.01 * Math.cos(radians(shooter_angle + 90));
                v_y = 0.01 * Math.sin(radians(shooter_angle + 90));
            }
        }
        // Space bar pressed, so can shoot the bubble
        else if (e.keyCode == '32') {
            if (!shooting && started && !paused)
                shooting = true;
        }
    }
}

// Move the bubble in the direction the cannon is aiming
function shoot() {
    var outerMat;
    var pm = ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);

    if (shooting) {
        outerMat = translate(shooter_bubble_x, shooter_bubble_y, 0.0);
        outerMat = mult(pm, outerMat);
        shooter_bubble_x += v_x;
        shooter_bubble_y += v_y;
        gl.uniformMatrix4fv(u_ctMatrixLoc, false, flatten(outerMat));
        draw_bubble(shooter_bubble_color);
    }
}

// Check position of the shooter bubble to check for collisions with wall or other bubbles
function check_collision() {
    var center_x, center_y, distance;

    if (shooter_bubble_x <= -0.95 || shooter_bubble_x >= 0.95)
        v_x = -v_x;
    if (shooter_bubble_y >= 0.95) {
        v_x = 0;
        v_y = 0;
        align_bubble();
        burst_bubbles();
    }

    // Loop through all existing top bubbles
    for (var i = 0; i < existing_bubbles.length; i++) {
        center_x = existing_bubbles[i][0];
        center_y = existing_bubbles[i][1];
        distance = Math.sqrt((center_x - shooter_bubble_x) ** 2 + (center_y - shooter_bubble_y) ** 2);

        // Collision occured, so align shooter bubble and check for chain burst
        if (distance <= 2 * radius) {
            v_x = 0;
            v_y = 0;
            align_bubble();
            burst_bubbles();
        }
    }
}

// Call align_odd() or align_even to align shooter bubble's position within its row
function align_bubble() {
    if (shooter_bubble_y <= 1.0 && shooter_bubble_y > 0.9) {
        shooter_bubble_y = 0.95;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= 0.9 && shooter_bubble_y > 0.8) {
        shooter_bubble_y = 0.85;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= 0.8 && shooter_bubble_y > 0.7) {
        shooter_bubble_y = 0.75;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= 0.7 && shooter_bubble_y > 0.6) {
        shooter_bubble_y = 0.65;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= 0.6 && shooter_bubble_y > 0.5) {
        shooter_bubble_y = 0.55;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= 0.5 && shooter_bubble_y > 0.4) {
        shooter_bubble_y = 0.45;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= 0.4 && shooter_bubble_y > 0.3) {
        shooter_bubble_y = 0.35;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= 0.3 && shooter_bubble_y > 0.2) {
        shooter_bubble_y = 0.25;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= 0.2 && shooter_bubble_y > 0.1) {
        shooter_bubble_y = 0.15;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= 0.1 && shooter_bubble_y > 0.0) {
        shooter_bubble_y = 0.05;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= 0.0 && shooter_bubble_y > -0.1) {
        shooter_bubble_y = -0.05;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= -0.1 && shooter_bubble_y > -0.2) {
        shooter_bubble_y = -0.15;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= -0.2 && shooter_bubble_y > -0.3) {
        shooter_bubble_y = -0.25;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }
    else if (shooter_bubble_y <= -0.3 && shooter_bubble_y > -0.4) {
        shooter_bubble_y = -0.35;
        if (rows % 2 == 0)
            align_even();
        else
            align_odd();
    }
    else if (shooter_bubble_y <= -0.4 && shooter_bubble_y > -0.5) {
        shooter_bubble_y = -0.45;
        if (rows % 2 == 0)
            align_odd();
        else
            align_even();
    }

    var outerMat;
    var pm = ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);

    outerMat = translate(shooter_bubble_x, shooter_bubble_y, 0.0);
    outerMat = mult(pm, outerMat);
    gl.uniformMatrix4fv(u_ctMatrixLoc, false, flatten(outerMat));
    draw_bubble(shooter_bubble_color);
}

function align_odd() {
    if (shooter_bubble_x <= 1.0 && shooter_bubble_x > 0.9)
        shooter_bubble_x = 0.95;
    else if (shooter_bubble_x <= 0.9 && shooter_bubble_x > 0.8)
        shooter_bubble_x = 0.85;
    else if (shooter_bubble_x <= 0.8 && shooter_bubble_x > 0.7)
        shooter_bubble_x = 0.75;
    else if (shooter_bubble_x <= 0.7 && shooter_bubble_x > 0.6)
        shooter_bubble_x = 0.65;
    else if (shooter_bubble_x <= 0.6 && shooter_bubble_x > 0.5)
        shooter_bubble_x = 0.55;
    else if (shooter_bubble_x <= 0.5 && shooter_bubble_x > 0.4)
        shooter_bubble_x = 0.45;
    else if (shooter_bubble_x <= 0.4 && shooter_bubble_x > 0.3)
        shooter_bubble_x = 0.35;
    else if (shooter_bubble_x <= 0.3 && shooter_bubble_x > 0.2)
        shooter_bubble_x = 0.25;
    else if (shooter_bubble_x <= 0.2 && shooter_bubble_x > 0.1)
        shooter_bubble_x = 0.15;
    else if (shooter_bubble_x <= 0.1 && shooter_bubble_x > 0.0)
        shooter_bubble_x = 0.05;
    else if (shooter_bubble_x <= 0.0 && shooter_bubble_x > -0.1)
        shooter_bubble_x = -0.05;
    else if (shooter_bubble_x <= -0.1 && shooter_bubble_x > -0.2)
        shooter_bubble_x = -0.15;
    else if (shooter_bubble_x <= -0.2 && shooter_bubble_x > -0.3)
        shooter_bubble_x = -0.25;
    else if (shooter_bubble_x <= -0.3 && shooter_bubble_x > -0.4)
        shooter_bubble_x = -0.35;
    else if (shooter_bubble_x <= -0.4 && shooter_bubble_x > -0.5)
        shooter_bubble_x = -0.45;
    else if (shooter_bubble_x <= -0.5 && shooter_bubble_x > -0.6)
        shooter_bubble_x = -0.55;
    else if (shooter_bubble_x <= -0.6 && shooter_bubble_x > -0.7)
        shooter_bubble_x = -0.65;
    else if (shooter_bubble_x <= -0.7 && shooter_bubble_x > -0.8)
        shooter_bubble_x = -0.75;
    else if (shooter_bubble_x <= -0.8 && shooter_bubble_x > -0.9)
        shooter_bubble_x = -0.85;
    else if (shooter_bubble_x <= -0.9 && shooter_bubble_x > -1.0)
        shooter_bubble_x = -0.95;
}

function align_even() {
    if (shooter_bubble_x <= 1.0 && shooter_bubble_x > 0.85)
        shooter_bubble_x = 0.9;
    else if (shooter_bubble_x <= 0.85 && shooter_bubble_x > 0.75)
        shooter_bubble_x = 0.8;
    else if (shooter_bubble_x <= 0.75 && shooter_bubble_x > 0.65)
        shooter_bubble_x = 0.7;
    else if (shooter_bubble_x <= 0.65 && shooter_bubble_x > 0.55)
        shooter_bubble_x = 0.6;
    else if (shooter_bubble_x <= 0.55 && shooter_bubble_x > 0.45)
        shooter_bubble_x = 0.5;
    else if (shooter_bubble_x <= 0.45 && shooter_bubble_x > 0.35)
        shooter_bubble_x = 0.4;
    else if (shooter_bubble_x <= 0.35 && shooter_bubble_x > 0.25)
        shooter_bubble_x = 0.3;
    else if (shooter_bubble_x <= 0.25 && shooter_bubble_x > 0.15)
        shooter_bubble_x = 0.2;
    else if (shooter_bubble_x <= 0.15 && shooter_bubble_x > 0.05)
        shooter_bubble_x = 0.1;
    else if (shooter_bubble_x <= 0.05 && shooter_bubble_x > -0.05)
        shooter_bubble_x = 0.0;
    else if (shooter_bubble_x <= -0.05 && shooter_bubble_x > -0.15)
        shooter_bubble_x = -0.1;
    else if (shooter_bubble_x <= -0.15 && shooter_bubble_x > -0.25)
        shooter_bubble_x = -0.2;
    else if (shooter_bubble_x <= -0.25 && shooter_bubble_x > -0.35)
        shooter_bubble_x = -0.3;
    else if (shooter_bubble_x <= -0.35 && shooter_bubble_x > -0.45)
        shooter_bubble_x = -0.4;
    else if (shooter_bubble_x <= -0.45 && shooter_bubble_x > -0.55)
        shooter_bubble_x = -0.5;
    else if (shooter_bubble_x <= -0.55 && shooter_bubble_x > -0.65)
        shooter_bubble_x = -0.6;
    else if (shooter_bubble_x <= -0.65 && shooter_bubble_x > -0.75)
        shooter_bubble_x = -0.7;
    else if (shooter_bubble_x <= -0.75 && shooter_bubble_x > -0.85)
        shooter_bubble_x = -0.8;
    else if (shooter_bubble_x <= -0.85 && shooter_bubble_x >= -1.0)
        shooter_bubble_x = -0.9;
}

// Burst bubble in chain reaction
function burst_bubbles() {
    var audio = new Audio('./sound/pop.mp3');

    num_existing_bubbles = existing_bubbles.length;
    cluster = 1;
    bursted = false;
    var dead_end = false;

    // Call recursive function, passing in shooter bubble variables
    burst_bubbles_r(shooter_bubble_x, shooter_bubble_y, dead_end);

    // Also burst floating bubbles and play popping audio
    if (bursted) {
        burst_floating_bubbles();
        audio.play();
        pops++;
        document.getElementById("num_pops").innerHTML = pops;
    }
    else {
        existing_bubbles.push(vec3(shooter_bubble_x, shooter_bubble_y, 0.0));
        bubble_colors.push(shooter_bubble_color);
    }

    // Generate info for new shooter bubble by cannon
    shooting = false;
    shooter_angle = 0.0;
    shooter_bubble_color = colors[(Math.floor(Math.random() * 3)) + color_index];
    shooter_bubble_x = (side_length*4 + radius)*Math.cos(radians(shooter_angle + 90));
    shooter_bubble_y = (side_length*4 + radius) * Math.sin(radians(shooter_angle + 90)) - 0.8;
    v_x = 0.01 * Math.cos(radians(shooter_angle + 90));
    v_y = 0.01 * Math.sin(radians(shooter_angle + 90));
}

// Recursively check every existing bubble to see if it's a neighbor of current bubble and in cluster of >=3 bubbles of same color as shooter bubble
function burst_bubbles_r(center_x, center_y, dead_end) {
    if (dead_end)
        return;

    // 6 neighbor bubbles
    var center_x1, center_x2, center_x3, center_x4, center_x5, center_x6, center_y1, center_y2, center_y3, center_y4, center_y5, center_y6;
    var local_bursted = false;

    // top
    center_x1 = center_x - radius;
    center_x1 = Math.round(center_x1 * 100) / 100;
    center_y1 = center_y + radius * 2;
    center_y1 = Math.round(center_y1 * 100) / 100;
    center_x2 = center_x + radius;
    center_x2 = Math.round(center_x2 * 100) / 100;
    center_y2 = center_y + radius * 2;
    center_y2 = Math.round(center_y2 * 100) / 100;
    // left
    center_x3 = center_x - radius * 2;
    center_x3 = Math.round(center_x3 * 100) / 100;
    center_y3 = center_y;
    center_y3 = Math.round(center_y3 * 100) / 100;
    // right
    center_x4 = center_x + radius * 2;
    center_x4 = Math.round(center_x4 * 100) / 100;
    center_y4 = center_y;
    center_y4 = Math.round(center_y4 * 100) / 100;
    // bottom
    center_x5 = center_x - radius;
    center_x5 = Math.round(center_x5 * 100) / 100;
    center_y5 = center_y - radius * 2;
    center_y5 = Math.round(center_y5 * 100) / 100;
    center_x6 = center_x + radius;
    center_x6 = Math.round(center_x6 * 100) / 100;
    center_y6 = center_y - radius * 2;
    center_y6 = Math.round(center_y6 * 100) / 100;

    var i = 0;

    while (i < num_existing_bubbles) {
        if (existing_bubbles[i][0] == center_x1 && existing_bubbles[i][1] == center_y1 && bubble_colors[i] == shooter_bubble_color) {
            // Increment cluster counter
            cluster++;

            // Track current bubble index in case it is part of a cluster (when current cluster count is only 2)
            if (cluster == 2) {
                temp_i = i;
                burst_bubbles_r(center_x1, center_y1, dead_end);
            }
            else if (cluster == 3) {
                existing_bubbles.splice(temp_i, 1);
                bubble_colors.splice(temp_i, 1);
                if (temp_i <= i)
                    i--;
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles -= 2;
                bursted = true;
                local_bursted = true;
                pops += 2;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x1, center_y1, dead_end);
            }
            else if (cluster > 3) {
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles--;
                bursted = true;
                local_bursted = true;
                pops++;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x1, center_y1, dead_end);
            }
        }
        else if (existing_bubbles[i][0] == center_x2 && existing_bubbles[i][1] == center_y2 && bubble_colors[i] == shooter_bubble_color) {
            cluster++;
            if (cluster == 2) {
                temp_i = i;
                burst_bubbles_r(center_x2, center_y2, dead_end);
            }
            else if (cluster == 3) {
                existing_bubbles.splice(temp_i, 1);
                bubble_colors.splice(temp_i, 1);
                if (temp_i <= i)
                    i--;
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles -= 2;
                bursted = true;
                local_bursted = true;
                pops += 2;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x2, center_y2, dead_end);
            }
            else if (cluster > 3) {
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles--;
                bursted = true;
                local_bursted = true;
                pops++;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x2, center_y2, dead_end);
            }
        }
        else if (existing_bubbles[i][0] == center_x3 && existing_bubbles[i][1] == center_y3 && bubble_colors[i] == shooter_bubble_color) {
            cluster++;
            if (cluster == 2) {
                temp_i = i;
                burst_bubbles_r(center_x3, center_y3, dead_end);
            }
            else if (cluster == 3) {
                existing_bubbles.splice(temp_i, 1);
                bubble_colors.splice(temp_i, 1);
                if (temp_i <= i)
                    i--;
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles -= 2;
                bursted = true;
                local_bursted = true;
                pops += 2;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x3, center_y3, dead_end);
            }
            else if (cluster > 3) {
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles--;
                bursted = true;
                local_bursted = true;
                pops++;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x3, center_y3, dead_end);
            }
        }
        else if (existing_bubbles[i][0] == center_x4 && existing_bubbles[i][1] == center_y4 && bubble_colors[i] == shooter_bubble_color) {
            cluster++;
            if (cluster == 2) {
                temp_i = i;
                burst_bubbles_r(center_x4, center_y4, dead_end);
            }
            else if (cluster == 3) {
                existing_bubbles.splice(temp_i, 1);
                bubble_colors.splice(temp_i, 1);
                if (temp_i <= i)
                    i--;
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles -= 2;
                bursted = true;
                local_bursted = true;
                pops += 2;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x4, center_y4, dead_end);
            }
            else if (cluster > 3) {
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles--;
                bursted = true;
                local_bursted = true;
                pops++;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x4, center_y4, dead_end);
            }
        }
        else if (existing_bubbles[i][0] == center_x5 && existing_bubbles[i][1] == center_y5 && bubble_colors[i] == shooter_bubble_color) {
            cluster++;
            if (cluster == 2) {
                temp_i = i;
                burst_bubbles_r(center_x5, center_y5, dead_end);
            }
            else if (cluster == 3) {
                existing_bubbles.splice(temp_i, 1);
                bubble_colors.splice(temp_i, 1);
                if (temp_i <= i)
                    i--;
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles -= 2;
                bursted = true;
                local_bursted = true;
                pops += 2;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x5, center_y5, dead_end);
            }
            else if (cluster > 3) {
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles--;
                bursted = true;
                local_bursted = true;
                pops++;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x5, center_y5, dead_end);
            }
        }
        else if (existing_bubbles[i][0] == center_x6 && existing_bubbles[i][1] == center_y6 && bubble_colors[i] == shooter_bubble_color) {
            cluster++;
            if (cluster == 2) {
                temp_i = i;
                burst_bubbles_r(center_x6, center_y6, dead_end);
            }
            else if (cluster == 3) {
                existing_bubbles.splice(temp_i, 1);
                bubble_colors.splice(temp_i, 1);
                if (temp_i <= i)
                    i--;
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles -= 2;
                bursted = true;
                local_bursted = true;
                pops += 2;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x6, center_y6, dead_end);
            }
            else if (cluster > 3) {
                existing_bubbles.splice(i, 1);
                bubble_colors.splice(i, 1);
                i = -1;
                num_existing_bubbles--;
                bursted = true;
                local_bursted = true;
                pops++;
                document.getElementById("num_pops").innerHTML = pops;
                burst_bubbles_r(center_x6, center_y6, dead_end);
            }
        }
        i++;
    }

    if (local_bursted == false)
        dead_end = true;
}

// Burst floating bubbles not connected to top of the screen via other bubbles
function burst_floating_bubbles() {
    visited = [];
    var dead_end;

    for (var i = 0; i < existing_bubbles.length; i++) {
        if (existing_bubbles[i][1] == 0.95)
            visited.push(vec3(existing_bubbles[i][0], existing_bubbles[i][1], 0.0));
    }

    for (var i = 0; i < visited.length; i++) {
        dead_end = false;
        add_neighbors_r(visited[i][0], visited[i][1], dead_end);
    }

    for (var i = 0; i < existing_bubbles.length; i++) {
        if (!is_in(existing_bubbles[i][0], existing_bubbles[i][1], visited)) {
            existing_bubbles.splice(i, 1);
            bubble_colors.splice(i, 1);
            i--;
            pops++;
            document.getElementById("num_pops").innerHTML = pops;
        }
    }
}

// Recursive function to check each neighbor of current bubble to see if it exists and has not been visited
function add_neighbors_r(center_x, center_y, dead_end) {
    if (dead_end)
        return;

    var center_x1, center_x2, center_x3, center_x4, center_x5, center_x6, center_y1, center_y2, center_y3, center_y4, center_y5, center_y6, has_neighbor;

    // top
    center_x1 = center_x - radius;
    center_x1 = Math.round(center_x1 * 100) / 100;
    center_y1 = center_y + radius * 2;
    center_y1 = Math.round(center_y1 * 100) / 100;
    center_x2 = center_x + radius;
    center_x2 = Math.round(center_x2 * 100) / 100;
    center_y2 = center_y + radius * 2;
    center_y2 = Math.round(center_y2 * 100) / 100;
    // left
    center_x3 = center_x - radius * 2;
    center_x3 = Math.round(center_x3 * 100) / 100;
    center_y3 = center_y;
    center_y3 = Math.round(center_y3 * 100) / 100;
    // right
    center_x4 = center_x + radius * 2;
    center_x4 = Math.round(center_x4 * 100) / 100;
    center_y4 = center_y;
    center_y4 = Math.round(center_y4 * 100) / 100;
    // bottom
    center_x5 = center_x - radius;
    center_x5 = Math.round(center_x5 * 100) / 100;
    center_y5 = center_y - radius * 2;
    center_y5 = Math.round(center_y5 * 100) / 100;
    center_x6 = center_x + radius;
    center_x6 = Math.round(center_x6 * 100) / 100;
    center_y6 = center_y - radius * 2;
    center_y6 = Math.round(center_y6 * 100) / 100;

    has_neighbor = false;

    if (is_in(center_x1, center_y1, existing_bubbles) && !is_in(center_x1, center_y1, visited)) {
        visited.push(vec3(center_x1, center_y1, 0.0));
        has_neighbor = true;
        add_neighbors_r(center_x1, center_y1, dead_end);
    }
    if (is_in(center_x2, center_y2, existing_bubbles) && !is_in(center_x2, center_y2, visited)) {
        visited.push(vec3(center_x2, center_y2, 0.0));
        has_neighbor = true;
        add_neighbors_r(center_x2, center_y2, dead_end);
    }
    if (is_in(center_x3, center_y3, existing_bubbles) && !is_in(center_x3, center_y3, visited)) {
        visited.push(vec3(center_x3, center_y3, 0.0));
        has_neighbor = true;
        add_neighbors_r(center_x3, center_y3, dead_end);
    }
    if (is_in(center_x4, center_y4, existing_bubbles) && !is_in(center_x4, center_y4, visited)) {
        visited.push(vec3(center_x4, center_y4, 0.0));
        has_neighbor = true;
        add_neighbors_r(center_x4, center_y4, dead_end);
    }
    if (is_in(center_x5, center_y5, existing_bubbles) && !is_in(center_x5, center_y5, visited)) {
        visited.push(vec3(center_x5, center_y5, 0.0));
        has_neighbor = true;
        add_neighbors_r(center_x5, center_y5, dead_end);
    }
    if (is_in(center_x6, center_y6, existing_bubbles) && !is_in(center_x6, center_y6, visited)) {
        visited.push(vec3(center_x6, center_y6, 0.0));
        has_neighbor = true;
        add_neighbors_r(center_x6, center_y6, dead_end);
    }

    if (has_neighbor == false)
        dead_end = true;
}

// Utility function to check if a bubble is in an array
function is_in(center_x, center_y, array) {
    for (var i = 0; i < array.length; i++) {
        if (array[i][0] == center_x && array[i][1] == center_y)
            return true;
    }

    return false;
}

// Calculate elapsed and
function count_down() {
    var now = new Date().getTime();
    var elapsed_time = now - start_time;

    // Time calculations for days, hours, minutes and seconds
    if (isNaN(elapsed_time))
        seconds = 0;
    else
        seconds = Math.floor(elapsed_time / 1000);


    // Display the result in the element with id="remaining_time"
    remaining_time = total_seconds - seconds;
    document.getElementById("remaining_time").innerHTML = remaining_time + "s";

    var lower_limit = 0.95 - 0.1 * 14;
    lower_limit = Math.round(lower_limit * 100) / 100;
    var lower_limit_reached = false;
    for (var i = 0; i < existing_bubbles.length; i++) {
        if (existing_bubbles[i][1] <= lower_limit) {
            lower_limit_reached = true;
            break;
        }
    }

    // If the count down is finished, give alert popup
    if (existing_bubbles.length == 0)
        alert("You win!");
    else if (seconds >= 120 && existing_bubbles.length > 0)
        alert("Game over");
    else if (lower_limit_reached)
        alert("Game over");
}

// Add new row every 30 seconds
function add_new_row() {
    var center_x, center_y, color;
    var temp_seconds = 120 - remaining_time;

    if (temp_seconds > 0 && temp_seconds % new_row_freq == 0) {
        for (var i = 0; i < existing_bubbles.length; i++) {
            existing_bubbles[i][1] -= 0.1;
            existing_bubbles[i][1] = Math.round(existing_bubbles[i][1] * 100) / 100;
        }

        if (temp_seconds % (2 * new_row_freq) == 0) {
            for (var j = 0; j < 20; j++) {
                center_x = -1.0 + radius * (2 * j + 1);
                center_x = Math.round(center_x * 100) / 100;
                center_y = 1.0 - radius;
                center_y = Math.round(center_y * 100) / 100;
                existing_bubbles.push(vec3(center_x, center_y, 0.0));
                color = Math.floor(Math.random() * 3);
                bubble_colors.push(colors[color + color_index]);
            }
        }
        else if (temp_seconds % new_row_freq == 0) {
            for (var j = 0; j < 19; j++) {
                center_x = -1.0 + radius * (2 * j + 2);
                center_x = Math.round(center_x * 100) / 100;
                center_y = 1.0 - radius;
                center_y = Math.round(center_y * 100) / 100;
                existing_bubbles.push(vec3(center_x, center_y, 0.0));
                color = Math.floor(Math.random() * 3);
                bubble_colors.push(colors[color + color_index]);
            }
        }

        rows++;
    }
}

// Re-render the screen
function render() {
    requestAnimFrame(render);

    if (!paused) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        choose_colors();
        draw_existing_bubbles();
        draw_shooter();
        change_shooter_direction();
        shoot();
        check_collision();
        count_down();
    }
}
