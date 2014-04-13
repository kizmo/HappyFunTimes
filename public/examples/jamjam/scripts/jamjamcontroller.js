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
    SyncedClock,
    AudioManager,
    Cookies,
    ExampleUI,
    Grid,
    Input,
    Misc,
    MobileHacks) {
  var g_client;
  var g_audioManager;
  var g_clock;
  var g_grid;
  var g_instrument;

  var globals = {
    bpm: 120,
    loopLength: 16,
    debug: false,
  };


  function $(id) {
    return document.getElementById(id);
  }


  function handleSetInstrument(data) {
    g_audioManager.loadSound(data.filename, data.filename, 1, function() {
      g_instrument = data.filename;
      g_audioManager.playSound(g_instrument);
    });
  }

  function reloadPage() {
    window.location.reload();
  }

  g_grid = new Grid({columns: 4, rows: 4, container: $("sequence")});

  var rhythmButtons = [];
  g_grid.forEach(function(cell) {
    rhythmButtons.push(cell.getElement());
  });

  var tracks = [
    {
      rhythm: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    },
  ];

  var addClass = function(element, className) {
    var classes = element.className.split(" ");
    if (classes.indexOf(className) < 0) {
      classes.push(className);
    }
    element.className = classes.join(" ");
  };

  var removeClass = function(element, className) {
    var classes = element.className.split(" ");
    var index = classes.indexOf(className);
    if (index >= 0) {
      classes.splice(index, 1);
    }
    element.className = classes.join(" ");
  };

  var addOrRemoveClass = function(element, className, add) {
    if (add) {
      addClass(element, className);
    } else {
      removeClass(element, className);
    }
  };

  var setDisplayForNote = function(trackIndex, rhythmIndex) {
    var elem = rhythmButtons[rhythmIndex];
    var rhythm = tracks[trackIndex].rhythm;
    addOrRemoveClass(elem, "noteOn", rhythm[rhythmIndex]);
  };

  var sendNote;

  var initButtons = function() {
    var rhythm = tracks[0].rhythm;
    var trackIndex = 0;
    for (var rhythmIndex = 0; rhythmIndex < globals.loopLength; ++rhythmIndex) {
      var elem = rhythmButtons[rhythmIndex];
      elem.innerHTML = "&#x25C9";
      setDisplayForNote(0, rhythmIndex);
      elem.addEventListener('click', function(trackIndex, rhythmIndex) {
        return function(e) {
          var rhythm = tracks[trackIndex].rhythm;
          rhythm[rhythmIndex] = !rhythm[rhythmIndex];
          sendNote(trackIndex, rhythmIndex, rhythm[rhythmIndex]);
          setDisplayForNote(trackIndex, rhythmIndex);
        };
      }(trackIndex, rhythmIndex));
    }
  };
  initButtons();

  var drawNote = function(trackIndex, rhythmIndex) {
    var rhythm = tracks[trackIndex].rhythm;
    var on = rhythm[rhythmIndex];
    addClass(rhythmButtons[rhythmIndex], on ? "notePlay" : "notePass");
    var prev = (globals.loopLength + rhythmIndex - 1) % globals.loopLength;
    var oldOn = rhythm[prev];
    removeClass(rhythmButtons[prev], "notePlay");
    removeClass(rhythmButtons[prev], "notePass");
  };

  // This isn't called until the clock is synced at least once.
  var start = function() {

    globals.disconnectFn = function() {
      // stop playing if we get disconnected.
      g_instrument = undefined;
    };

    Misc.applyUrlSettings(globals);
    MobileHacks.fixHeightHack();
    var stop = false;

    g_client = new GameClient({
      gameId: "jamjam",
    });

    g_client.addEventListener('setInstrument', handleSetInstrument);

    ExampleUI.setupStandardControllerUI(g_client, globals);

    var color = Misc.randCSSColor();
    g_client.sendCmd('setColor', { color: color });
    document.body.style.backgroundColor = color;

    var sendTracks = function() {
      g_client.sendCmd('tracks', { tracks: tracks });
    };
    sendTracks();

    sendNote = function(trackIndex, rhythmIndex, on) {
      g_client.sendCmd('note', {
        t: trackIndex,
        r: rhythmIndex,
        n: on,
      });
    };

    g_audioManager = new AudioManager();

    var startTime = g_clock.getTime();

    var playNote = function(track, noteTime) {
      if (g_instrument) {
        g_audioManager.playSound(g_instrument, noteTime);
      }
    };

    var secondsPerBeat = 60 / globals.bpm;
    var secondsPerQuarterBeat = secondsPerBeat / 4;
    var lastQueuedQuarterBeat = Math.floor(startTime / secondsPerQuarterBeat);
    var lastDisplayedQuarterBeat = lastQueuedQuarterBeat;

    if (globals.debug) {
      var status = $("status").firstChild;
      var debugCSS = Misc.findCSSStyleRule("#debug");
      debugCSS.style.display = "block";
    }

    function process() {
      var currentTime = g_clock.getTime();
      var currentQuarterBeat = Math.floor(currentTime / secondsPerQuarterBeat);
      var audioClockTime = g_audioManager.getTime();

      if (globals.debug) {
        var beat = Math.floor(currentQuarterBeat / 4) % 4;
        var clockDiff = (currentTime - startTime) - audioClockTime;
        status.nodeValue =
          "\n ct: " + currentTime.toFixed(2).substr(-5) +
          "\nacd: " + clockDiff.toFixed(5) +
          "\ncqb: " + currentQuarterBeat.toString().substr(-4) +
          "\n rt: " + currentQuarterBeat % globals.loopLength +
          "\n bt: " + beat + ((beat % 2) == 0 ? " ****" : "");
      }

      var quarterBeatToQueue = currentQuarterBeat + 2;
      while (lastQueuedQuarterBeat < quarterBeatToQueue) {
        ++lastQueuedQuarterBeat;
        var timeForBeat = lastQueuedQuarterBeat * secondsPerQuarterBeat;
        var timeUntilBeat = timeForBeat - currentTime;
        var contextPlayTime = audioClockTime + timeUntilBeat;
        var rhythmIndex = lastQueuedQuarterBeat % globals.loopLength;

        for (var ii = 0; ii < tracks.length; ++ii) {
          var track = tracks[ii];
          var rhythm = track.rhythm;
          if (rhythm[rhythmIndex]) {
            playNote(track, contextPlayTime);
          }
        }
      }

      if (lastDisplayedQuarterBeat != currentQuarterBeat) {
        lastDisplayedQuarterBeat = currentQuarterBeat;
        if (g_instrument) {
          drawNote(0, currentQuarterBeat % globals.loopLength);
        }
      }

      if (!stop) {
       setTimeout(process, 100);
      }
    }
    process();
  };

  g_clock = SyncedClock.createClock(true, undefined, start);
};

// Start the main app logic.
requirejs(
  [ '../../../scripts/gameclient',
    '../../../scripts/syncedclock',
    '../../scripts/audio',
    '../../scripts/cookies',
    '../../scripts/exampleui',
    '../../scripts/grid',
    '../../scripts/input',
    '../../scripts/misc',
    '../../scripts/mobilehacks',
  ],
  main
);

