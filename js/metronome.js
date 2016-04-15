/**
    TODO:
     - use multiple sounds
     - use timestamp parameter of animation frame callback?
     - FIX: when 'Stop' is clicked multiple times, restarting
       count stops after one beat.  Pressing 'Start' then
       works.  Pressing 'Stop" again leads to the same problem.
*/

var on = document.getElementById('start'),
    off = document.getElementById('stop'),
    inputBox = document.querySelector('input'),
    subdivide = document.getElementById('subdivide'),
    duple = document.getElementById('duple'),
    triple = document.getElementById('triple'),
    lights = document.getElementById('lights');

/**
    Create DOM elements for beat display.
*/
for (var i = 0; i < 2; i++) {
    var light = document.createElement('div');
    light.setAttribute('class', 'visualbeat');
    light.setAttribute('id', 'beat' + i);
    lights.appendChild(light);
}

var beepFrame = false,
    playSubdivisions = false;

var secondsPerBeat;
/**
    an object storing sounds and their location within the pattern.  Location
    is expressed as a floating-point number between 0.0 and 1.0.  This will
    be multiplied by the seconds-per-beat to give the offset in seconds.
    [[buffer1, fraction1], [buffer2, fraction2]]
*/
var pattern = [];

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var request = new XMLHttpRequest();
// Beep sound taken from Audiosoundclips.com:
// http://audiosoundclips.com/wp-content/uploads/2011/12/Beep.mp3
//request.open('GET', 'Beep.mp3', true);
// Sound derived from metronome sound by Mike Koenig at
// http://soundbible.com/914-Metronome.html
request.open('GET', 'metronome_sound.mp3', true);
request.responseType = 'arraybuffer';

request.onload = function () {
    audioCtx.decodeAudioData(request.response, function (buffer) {

        // initialize pattern with a single beat
        pattern.push([buffer, 0.0]);

        /**
            Very rough visuals.
        */
        // Array to store note times for visual synchronization
        var noteTimeArray;
        var visualBeats = document.getElementsByClassName('visualbeat');
        var beat;

        var updateDisplay = function() {
            if (noteTimeArray.length && audioCtx.currentTime > noteTimeArray[0]) {
                //visualBeats[beat].classList.add('show');
                visualBeats[beat].style.backgroundColor = 'red';
                if (beat === 0) {
                    //visualBeats[visualBeats.length - 1].classList.remove('show');
                    visualBeats[visualBeats.length - 1].style.backgroundColor = 'white';
                } else {
                    //visualBeats[beat - 1].classList.remove('show');
                    visualBeats[beat - 1].style.backgroundColor = 'white';
                }

                if (beat === visualBeats.length - 1) {
                    beat = 0;
                } else {
                    beat++;
                }
                noteTimeArray.shift();
            }
        };

        var whereInPattern;
        // default = no subdivision
        var division = 1;

        function resetPattern() {
            pattern = [[buffer, 0.0]];
            whereInPattern = 0; // why needed? set to 0 in beepFunction ...
        }

        function updatePattern() {
            resetPattern();
            if (division > 1) {
                for(var i = 1; i < division; i++) {
                    pattern.push([buffer, i * 1/division]);
                }
            }
        }

        /**
            Flags representing initiation and termination of a count.
        */
        var countStart,
            endCount;
        /**
            How much the first beep will happen after the start
            button is clicked.  We do this partly so that first beat is
            not shortened -- noticeably so on my Samsung Galaxy SIII.
        */
        var startOffset = 0.4;
        /**
            Local tempo; needed b/c we only change tempo by the pattern
            statement, though the user can request a change at any time.
        */
        var patternSeconds,
            patternStartTime;

        var newNoteEntry,
            lastNoteTime,
            newNoteTime;
        /**
            Flag indicating whether we have changed tempo or changed to
            subdivisions or back to beats only.
        */
        var handleRateChange = false;

        var beepFunction = function() {
            updateDisplay();
            /**
                As soon as possible after a note starts playing, schedule
                the next one.

                Note: if the tempo gets really really fast, condition
                will always be true.  Current time will drift from
                last note time.  Notes will be scheduled further and
                further in the past (meaning that they will sound in
                the present).
            */
            if (audioCtx.currentTime > lastNoteTime){
                //console.log((audioCtx.currentTime - lastNoteTime) * 1000);
                /**
                    Advance where we are in pattern.  If we are at the
                    end, return to first note and process any Changes
                    of division and tempo.
                */
                if (whereInPattern === pattern.length - 1) {
                    whereInPattern = 0;
                    /**
                        If a change is requested, the arrival of the
                        new pattern statement happens according to the
                        old tempo.  Then the new settings take effect.

                        Don't delay the very first beat by the pattern
                        length, though.
                    */
                    if (!countStart) {
                        patternStartTime += patternSeconds;
                    }
                    if (handleRateChange) {
                        patternSeconds = secondsPerBeat;
                        updatePattern();
                        handleRateChange = false;
                    }
                } else {
                    whereInPattern++;
                }

                newNoteEntry = pattern[whereInPattern];
                newNoteTime = patternStartTime + newNoteEntry[1] * patternSeconds;
                if (whereInPattern === 0) {
                    scheduleSound(newNoteEntry[0], newNoteTime);
                } else {
                    scheduleOffbeatSound(newNoteEntry[0], newNoteTime);
                }

                if (countStart) {
                    countStart = false;
                }

                lastNoteTime = newNoteTime;
                // Subdivision disabled in visuals...
                if (whereInPattern === 0) {
                    noteTimeArray.push(lastNoteTime);
                }
            }

            if (endCount) {
                /**
                    Visuals are out of sync with audio scheduling, since
                    screen updates are done "in the present," and sounds
                    are prepared for the future.  After scheduling the
                    last *tock*, we must continue to watch the time so
                    we can call a screen update when the last sound
                    arrives.

                    Perhaps this could be more elegantly done than by
                    a dead loop.
                */
                while (audioCtx.currentTime < lastNoteTime) {
                    // biding our time...
                }
                updateDisplay();
                cancelAnimationFrame(beepFrame);
                beepFrame = false;
                endCount = false;
            } else {
                beepFrame = requestAnimationFrame(beepFunction);
            }
        };

        on.onclick = function() {
            setSecondsPerBeat();
            /**
                We only honor the first click of start button.  While count
                is in progress, all clicks are ignored.
            */
            if (!beepFrame) {
                countStart = true;
                noteTimeArray = [];
                beat = 0;
                patternSeconds = secondsPerBeat;
                patternStartTime = audioCtx.currentTime + startOffset;
                // set to -1 so beepFunction loop triggers immediately
                lastNoteTime = -1;
                /**
                    Set to last note of the pattern.  Subdivisions are
                    processed as a change, and beepFunction only allows
                    changes when we reach the last note of a pattern.  We
                    will start with the right note b/c whereInPattern is
                    set to 0 after changes are processed.
                */
                whereInPattern = pattern.length - 1;
                beepFrame = requestAnimationFrame(beepFunction);
            }
        };

        off.onclick = function() {
            endCount = true;
        };

        /**
            Set a new speed.
        */
        inputBox.onchange = function() {
            setSecondsPerBeat();
            handleRateChange = true;
        };
        /**
            Subdivide
        */
        subdivide.onclick = function() {
            playSubdivisions = !playSubdivisions; // toggle

            if (playSubdivisions) {
                division = (duple.checked) ? 2 : 3;
                subdivide.innerHTML = 'subdivide off';
            } else {
                resetPattern();
                division = 1;
                subdivide.innerHTML = 'subdivide';
            }

            handleRateChange = true;
        };

        duple.onclick = function() {
            division = 2;
            if (playSubdivisions) handleRateChange = true;
        };

        triple.onclick = function() {
            division = 3;
            if (playSubdivisions) handleRateChange = true;
        };
    });
};

request.send();

function scheduleSound(buffer, time) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(audioCtx.destination);
    bufferSource.start(time);
}

function scheduleOffbeatSound(buffer, time) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.2;
    bufferSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    bufferSource.start(time);
}

function setSecondsPerBeat() {
    var beatsPerMinute = document.getElementById('bpm').value;
    secondsPerBeat = 60/beatsPerMinute;
}
