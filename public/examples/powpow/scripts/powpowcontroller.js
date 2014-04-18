/*
 * Copyright 2014, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

var main = function(
    GameClient,
    AudioManager,
    ExampleUI,
    HandJS,
    Misc,
    Input,
    MobileHacks,
    Ships) {

  var g_name = "";
  var g_turn = 0;
  var g_oldTurn = 0;
  var g_left = false;
  var g_right = false;
  var g_fire = false;
  var g_dirTouchStart = 0;
  var g_numTouches = 0;
  var g_ctx = 0;
  var g_canvas;
  var g_startX;
  var g_startY;
  var g_startTime;
  var g_state = ""
  var g_count;
  var g_playerColor = "black";
  var g_playerStyle;
  var g_client;
  var g_audioManager;
  var g_clearMsgTimeoutId;

  var globals = {
    messageDuration: 5,
  };
  Misc.applyUrlSettings(globals);
  MobileHacks.fixHeightHack();

  function $(id) {
    return document.getElementById(id);
  }

  var msgElem = $("msg");
  var colorElem = $("surface");

  var clearMessage = function() {
    g_clearMsgTimeoutId = undefined;
    msgElem.innerHTML = "";
  };

  var setClearMessageTimeout = function() {
    if (g_clearMsgTimeoutId !== undefined) {
      clearTimeout(g_clearMsgTimeoutId);
    }
    g_clearMsgTimeoutId = setTimeout(clearMessage, globals.messageDuration * 1000);
  };

  var setMessage = function(color, msg) {
    msgElem.innerHTML = msg;
    msgElem.style.color = color;
    setClearMessageTimeout();
  };

  var process;
  var g_states = {
    launch: function() {
      --g_count;
      if (g_count > 0) {
        colorElem.style.backgroundColor = (g_count % 2) ? "#0f0" : "#fff";
        setTimeout(process, 100);
      } else {
        colorElem.style.backgroundColor = g_playerColor;
      }
    },

    die: function() {
      --g_count;
      if (g_count > 0) {
        colorElem.style.backgroundColor = (g_count % 2) ? "#f00" : "#ff0";
        setTimeout(process, 100);
      } else {
        colorElem.style.backgroundColor = g_playerColor;
      }
    }
  };

  process = function() {
    g_states[g_state]();
  };


  function handleSetColorMsg(msg) {
    var canvas = document.createElement("canvas");
    canvas.width = 150;
    canvas.height = 150;
    var xOff = canvas.width / 2;
    var yOff = canvas.height / 2;
    var ctx = canvas.getContext("2d");
    var styleName = Ships.styles[msg.style];
    for (var yy = -2; yy <= 2; ++yy) {
      for (var xx = -2; xx <=2; ++xx) {
        Ships.drawShip(ctx, xx + xOff, yy + yOff, Math.PI, "#000");
      }
    }
    Ships[styleName](ctx, xOff, yOff, Math.PI, msg.color);
    $("ship").src = canvas.toDataURL();
    //e.style.backgroundImage = "url(" + canvas.toDataURL() + ")";
  }

  function handleKillMsg(msg) {
    setMessage('#0FF', 'Killed ' + msg.killed);
  }

  function handleDieMsg(msg) {
    g_audioManager.playSound('explosion');
    setMessage('#F00', (msg.crash ? 'Crashed into ' : 'Killed by ') + msg.killer);
    g_state = "die";
    g_count = 20;
    setTimeout(process, 100);
  }

  function handleLaunchMsg(msg) {
    g_audioManager.playSound('launching');
    setMessage('#FF0', 'Launch!');
    g_state = "launch";
    g_count = 30;
    setTimeout(process, 100);
  }

  function handleQueueMsg(msg) {
    setMessage('#FFF', msg.count > 0 ?
        (msg.count.toString() + " ahead of you") : "Next Up");
  }

  function touchMoveStart(event) {
    event.preventDefault();
    var allTouches = event.touches;
    for (var ii = 0; ii < allTouches.length; ++ii) {
      ++g_numTouches;
      var touch = allTouches[ii];
      g_dirTouchStart = touch.pageX;
      break;
    }
  }

  function touchMoveMove(event) {
    event.preventDefault();
    //debugTouch("move", event);
    var allTouches = event.touches;
    for (var ii = 0; ii < allTouches.length; ++ii) {
      var touch = allTouches[ii];
      var dx = touch.pageX - g_dirTouchStart;
      //logTo("status", dx)
      var fudge = 10
      if (dx < -fudge) {
        if (!g_left) {
          g_left = 1;
          g_right = 0;
          g_client.sendCmd('turn', {
              turn: -1
          });
        }
      } else if (dx > fudge) {
        if (!g_right) {
          g_left = 0;
          g_right = 1;
          g_client.sendCmd('turn', {
              turn: 1
          });
        }
      } else {
        if (g_right || g_left) {
          g_left = 0;
          g_right = 0;
          g_client.sendCmd('turn', {
              turn: 0
          });
        }
      }
      break;
    }
  }

  function touchMoveEnd(event) {
    event.preventDefault();
    if (g_right || g_left) {
      g_left = 0;
      g_right = 0;
      g_client.sendCmd('turn', {
         turn: 0
      });
    }
    //debugTouch("end", event);
  }

  function touchMoveCancel(event) {
    touchMoveEnd(event)
  }

  function touchFireStart(event) {
    event.preventDefault();
    if (!g_fire) {
      g_fire = true;
      g_client.sendCmd('fire', {
          fire: 1
      });
    }

    //debugTouch("start", event);
  }

  function touchFireMove(event) {
    event.preventDefault();
    //debugTouch("move", event);
  }

  function touchFireEnd(event) {
    event.preventDefault();
    if (g_fire) {
      g_fire = false;
      g_client.sendCmd('fire', {
          fire: 0
      });
    }
    //debugTouch("end", event);
  }

  function touchFireCancel(event) {
    touchFireEnd(event);
    //debugTouch("cancel", event);
  }

  function updateTarget(element, x, y) {
    var centerX = element.clientWidth / 2;
    var centerY = element.clientHeight / 2;
    var dx = x - centerX;
    var dy = y - centerY;
    var direction = Math.atan2(dy, dx);
    g_client.sendCmd('target', {
        target: (direction + Math.PI / 2 * 3) % (Math.PI * 2)
    });

    var ctx = g_ctx;
    ctx.clearRect(0, 0, g_canvas.width, g_canvas.height);
    ctx.save();
    ctx.translate(g_canvas.width / 2, g_canvas.height / 2);
    ctx.rotate(direction - Math.PI / 2);
    ctx.fillStyle = "#FF0";
    ctx.beginPath();
    ctx.closePath();
    ctx.moveTo(10, 0);
    ctx.lineTo(10, 50);
    ctx.lineTo(30, 50);
    ctx.lineTo(0, 70);
    ctx.lineTo(-30, 50);
    ctx.lineTo(-10, 50);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  };

  function handleKeyDown(keyCode, state) {
    switch(keyCode) {
    case 37: // left
      if (!g_left) {
        g_left = true;
        g_client.sendCmd('turn', {
            turn: -1
        });
      }
      break;
    case 39: // right
      if (!g_right) {
        g_right = true;
        g_client.sendCmd('turn', {
            turn: 1
        });
      }
      break;
    case 90: // z
      if (!g_fire) {
        g_fire = true;
        g_client.sendCmd('fire', {
            fire: 1
        });
      }
      break;
    }
  }

  function handleKeyUp(keyCode, state) {
    switch(keyCode) {
    case 37: // left
      g_left = false;
      g_client.sendCmd('turn', {
          turn: (g_right) ? 1 : 0
      });
      break;
    case 39: // right
      g_right = false;
      g_client.sendCmd('turn', {
          turn: (g_left) ? -1 : 0
      });
      break;
    case 90: // z
      g_fire = false;
      g_client.sendCmd('fire', {
          fire: 0
      });
      break;
    }
  }

  g_client = new GameClient({
    gameId: "powpow",
  });

  g_client.addEventListener('setColor', handleSetColorMsg);
  g_client.addEventListener('kill', handleKillMsg);
  g_client.addEventListener('die', handleDieMsg);
  g_client.addEventListener('launch', handleLaunchMsg);
  g_client.addEventListener('queue', handleQueueMsg);

  ExampleUI.setupStandardControllerUI(g_client, globals);

  var sounds = {
    explosion: {
      filename: "assets/explosion.ogg",
      samples: 1,
    },
    launching: {
      filename: "assets/launching.ogg",
      samples: 1,
    }
  };
  g_audioManager = new AudioManager(sounds);

  Ships.setShipSize(70);

  var haveTouch = 'ontouchstart' in document

  if (haveTouch) {
    var tcmove = $("tcmove");
    var tcfire = $("tcfire");
    tcmove.addEventListener("touchstart", touchMoveStart, false);
    tcmove.addEventListener("touchmove", touchMoveMove, false);
    tcmove.addEventListener("touchend", touchMoveEnd, false);
    tcmove.addEventListener("touchcancel", touchMoveCancel, false);
    tcfire.addEventListener("touchstart", touchFireStart, false);
    tcfire.addEventListener("touchmove", touchFireMove, false);
    tcfire.addEventListener("touchend", touchFireEnd, false);
    tcfire.addEventListener("touchcancel", touchFireCancel, false);
  } else {
    var keyControls = $("keyControls");
    var touchControls = $("touchControls");
    keyControls.style.display = "block";
    touchControls.style.display = "none";
  }

  Input.setupControllerKeys(handleKeyDown, handleKeyUp);
};

// Start the main app logic.
requirejs(
  [ '../../../scripts/gameclient',
    '../../scripts/audio',
    '../../scripts/exampleui',
    '../../scripts/hand-1.3.7',
    '../../scripts/misc',
    '../../scripts/input',
    '../../scripts/mobilehacks',
    'ships',
  ],
  main
);

