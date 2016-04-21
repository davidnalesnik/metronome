/**
    TODO:
     - use multiple sounds
     - add settings menu
     - allow visuals to be turned off
     - number of beat boxes variable
     - metric accentuation
     - remember settings between sessions
*/

try {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    alert('Web Audio API support required.');
}

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
function storageAvailable(type) {
	try {
		var storage = window[type],
			x = '__storage_test__';
		storage.setItem(x, x);
		storage.removeItem(x);
		return true;
	}
	catch(e) {
		return false;
	}
}

var haveLocalStorage = (storageAvailable('localStorage')) ? true : false;

var on = document.getElementById('start'),
    off = document.getElementById('stop'),
    inputBox = document.querySelector('input'),
    subdivide = document.getElementById('subdivide'),
    duple = document.getElementById('duple'),
    triple = document.getElementById('triple'),
    lights = document.getElementById('lights'),
    bpm = document.getElementById('bpm');
    mute = document.getElementById('mute');

/**
    Create DOM elements for beat display.
*/
for (var i = 0; i < 4; i++) {
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
    be multiplied by secondsPerBeat to give the offset in seconds.

    Syntax: [[buffer1, fraction1], [buffer2, fraction2]]
*/
var pattern = [];

var muted;
if (!haveLocalStorage) {
    muted = false;
} else {
    if (!localStorage.getItem('muted')) {
        localStorage.setItem('muted', 'false');
        muted = false;
    } else {
        muted = JSON.parse(localStorage.getItem('muted'));
    }
}

function setMuteButtonText() {
    mute.innerHTML = (muted) ? 'unmute' : 'mute';
}
setMuteButtonText();

var MM_DEFAULT = 60;
var MM_MIN = 1;
var MM_MAX = 250;

if (!haveLocalStorage) {
    bpm.setAttribute('value', MM_DEFAULT);
} else {
    if (!localStorage.getItem('bpm')) {
        bpm.setAttribute('value', MM_DEFAULT);
        localStorage.setItem('bpm', JSON.stringify(MM_DEFAULT));
    } else {
        bpm.setAttribute('value', JSON.parse(localStorage.getItem('bpm')));
    }
}

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
        //var noteTimeArray;
        var visualBeats = document.getElementsByClassName('visualbeat');
        var beat;

        var updateDisplay = function() {
            // Show new beat.
            // Hmm.  If endSignalled and we are on a subdivision other than last,
            // we don't want to show anything.  Instead we want to hold and
            // erase the current beat.
            visualBeats[beat].style.backgroundColor = 'red';

            // Hide previous beat.
            if (beat === 0) {
                visualBeats[visualBeats.length - 1].style.backgroundColor = 'white';
            } else {
                visualBeats[beat - 1].style.backgroundColor = 'white';
            }

            // Clear the last element when the count has stopped.
            if (endSignalled) {
                /**
                    Keep a record of beat to clear.  This is done because
                    otherwise, If the start of a new count happens before
                    the callback is executed, the wrong element will be
                    cleared.  (The variable beat has changed in the
                    meantime.)
                */
                var finalBeat = beat;
                var timeoutID = setTimeout(function() {
                    visualBeats[finalBeat].style.backgroundColor = 'white';
                }, secondsPerBeat * 1000);
            }

           // if (noteTimeArray.length) noteTimeArray.shift();
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
        var countJustBegun,
            endSignalled;
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

        /**
            This function handles audio scheduling and updates the display
            when it is time to change beats.

            Note: Visuals are out of sync with audio scheduling, since
            screen updates are done "in the present," and sounds
            are prepared for the future.  After scheduling the
            last *tock*, we continue to watch the time in order
            to call a screen update when the last sound arrives.
        */
        var beepFunction = function() {
            /**
                As soon as possible after a note starts playing, schedule
                the next one.

                Note: if the tempo gets really really fast, condition
                below will always be true.  Current time will drift from
                last note time.  Notes will be scheduled further and
                further in the past (meaning that they will sound in
                the present).
            */
            if (audioCtx.currentTime >= lastNoteTime){
                /**
                    If we have just begun a count, we don't want to call
                    display because the beginning cycle schedules a future
                    audio event.

                    Checking whether whereInPattern is 0 limits display to
                    beats rather than every subdivision.

                    If count end is requested, we need to clear the currently
                    lit element.
                */
                if ((!countJustBegun && whereInPattern === 0) || endSignalled) {
                    updateDisplay();
                }

                /**
                    Advance "beat" for display.
                */
                if (!endSignalled && whereInPattern == pattern.length - 1) {
                    if (beat === visualBeats.length - 1) {
                        beat = 0;
                    } else {
                        beat++;
                    }
                }

                if (endSignalled) {
                    cancelAnimationFrame(beepFrame);
                    beepFrame = false;
                    endSignalled = false;
                    return;
                } else {
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
                        if (!countJustBegun) {
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

                    if (countJustBegun) {
                        countJustBegun = false;
                    }

                    lastNoteTime = newNoteTime;

                    // Subdivision disabled in visuals; only downbeats added to array
                    //if (whereInPattern === 0) {
                     //   noteTimeArray.push(lastNoteTime);
                //}
                }
            }

            beepFrame = requestAnimationFrame(beepFunction);
        };

        on.onclick = function() {
            setSecondsPerBeat();
            /**
                We only honor the first click of start button.  While count
                is in progress, all clicks are ignored.
            */
            if (!beepFrame) {
                countJustBegun = true;
                endSignalled = false;
                //noteTimeArray = [];
                beat = -1;
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
            endSignalled = true;
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

        /**
            SOUND

            Pressing mute/unmute button or spacebar toggles sound.
        */
        function toggleSound() {
            muted = !muted;
            if (haveLocalStorage) {
                localStorage.setItem('muted', JSON.stringify(muted));
            }
            setMuteButtonText();
            // So spacebar can be used right after mouseclick
            mute.blur();
        }

        mute.onclick = function() {
            console.log();
            toggleSound();
        };

        document.body.onkeyup = function(ev){
            if(ev.keyCode == 32) {
                toggleSound();
            }
        };
    });
};

request.send();

function scheduleSound(buffer, time) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = (muted) ? 0.0 : 1.0;
    bufferSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    bufferSource.start(time);
}

function scheduleOffbeatSound(buffer, time) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = (muted) ? 0.0 : 0.2;
    bufferSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    bufferSource.start(time);
}

function setSecondsPerBeat() {
    var val = getNormalizedInput(bpm.value);
    secondsPerBeat = 60/val;
    if (haveLocalStorage) {
        localStorage.setItem('bpm', JSON.stringify(val));
    }
}

/**
    If user input is out of supported bounds, modify it and display.
*/
function getNormalizedInput(inp) {
    if (inp < MM_MIN || inp > MM_MAX) {
        inp = Math.max(MM_MIN, inp);
        inp = Math.min(inp, MM_MAX);
        // update display with normalized value
        bpm.value = inp;
    }
    return inp;
}
