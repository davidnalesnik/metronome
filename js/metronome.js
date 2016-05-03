/**
    TODO:
    - collect more sounds
    - provide mechanism for choosing sounds
    - metric accentuation
    - remember more settings between sessions (meter, sound
    assignments)
*/

/**
    Create AudioContext.
*/

try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var audioCtx = new window.AudioContext();
} catch (e) {
    alert('Web Audio API support required.');
}

/**
    DOM selectors
*/
var sideMenuToggle = document.getElementById('side-menu-toggle'),
    downbeatAccentToggle = document.getElementById('downbeat-accent-toggle'),
    beatVisibilityToggle = document.getElementById('beat-visibility-toggle'),
    on = document.getElementById('start-button'),
    off = document.getElementById('stop-button'),
    tempoTapTarget = document.getElementById('tempo-tap-target'),
    subdivide = document.getElementById('subdivide-button'),
    divisions = document.getElementById('divisions'),
    beatBubbles = document.getElementById('beat-bubbles'),
    beatCount = document.getElementById('beat-count'),
    bpm = document.getElementById('bpm'),
    mute = document.getElementById('mute');

/**
    Show/hide options menu.
*/
sideMenuToggle.onclick = function(ev) {
     //ev.preventDefault();
     this.parentNode.classList.toggle('show-side-menu');
};

/**
    Default settings
*/
var MUTED_DEFAULT = false,
    MM_DEFAULT = 60,
    MM_MIN = 1,
    MM_MAX = 250,
    BEAT_COUNT_DEFAULT = 4,
    TAPS_TO_SET_TEMPO = 5,
    ACCENT_DOWNBEAT = false,
    BEAT_VISIBLE = true;

/**
    DATA STORAGE

    If possible, settings persist between sessions.

    We remember the following:
     - whether sound is muted,
     - the tempo,
     - the number of beats,
     - whether beats are displayed,
     - and whether downbeats are accented.

    If the browser does not support the Web Storage API, we will
    use default values.
*/

/**
    Check if we can store data between browser sessions.  Function taken from
    https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
*/
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

var haveLocalStorage = storageAvailable('localStorage');
// for testing:
//haveLocalStorage = false;

function setStoredVariable(name, val) {
    if (haveLocalStorage) {
        localStorage.setItem(name, JSON.stringify(val));
    }
}

/**
    Used at the beginning of a session for managing a variable
    that may be in storage.

    Since the function returns a value, it may be used as an
    initializer.
*/
function initializeStoredVariable(name, val) {
    if (haveLocalStorage) {
        var setting = localStorage.getItem(name);
        if (setting) {
            return JSON.parse(setting);
        }
        setStoredVariable(name, val);
    }
    return val;
}

/**
    Used at the beginning of a session for setting DOM attributes to
    values that may be in storage.
*/
function initializeStorableProperty(elt, name, prop, val) {
    if (haveLocalStorage) {
        var setting = localStorage.getItem(name);
        if (setting) {
            elt.setAttribute(prop, JSON.parse(setting));
        } else {
            elt.setAttribute(prop, val);
            localStorage.setItem(name, JSON.stringify(val));
        }
    } else {
        elt.setAttribute(prop, val);
    }
}

/**
    Initial mute/unmute
*/
var muted = initializeStoredVariable('muted', MUTED_DEFAULT);

if (muted) {
    mute.classList.add('muted');
}

/**
    Initial tempo
*/
initializeStorableProperty(bpm, 'bpm', 'value', MM_DEFAULT);

/**
    Initial beat count
*/
var numberOfBeats = initializeStoredVariable('numberOfBeats', BEAT_COUNT_DEFAULT);

beatCount[numberOfBeats - 2].setAttribute('selected', true);

/**
    Initial accent downbeat
*/
var accentDownbeat = initializeStoredVariable('accentDownbeat', ACCENT_DOWNBEAT);

downbeatAccentToggle.checked = accentDownbeat;

/**
    Initial beat visibility
*/
var beatVisible = initializeStoredVariable('beatVisible', BEAT_VISIBLE);

beatVisibilityToggle.checked = beatVisible;

if (!beatVisible) {
    beatBubbles.classList.add('hide-beats');
}

/**
    LOAD SOUNDS

    Retrieve sounds and store decoded data in soundLibrary object
    with meaningful identifiers. An entry of 'false' indicates an
    unsuccessful load.

    Once all sounds are loaded, call init function.

    Beep.mp3 taken from Audiosoundclips.com:
    http://audiosoundclips.com/wp-content/uploads/2011/12/Beep.mp3

    metronome_sound.mp3 derived from metronome sound by Mike Koenig:
    http://soundbible.com/914-Metronome.html
*/

var soundLibrary = {};

var soundFiles = {
    tock: 'metronome_sound.mp3',
    harshBeep: 'Beep.mp3',
    harshBeepCopy: 'beepcopy.mp3'
};

function loadSound(key, url) {
    var fileCount = Object.keys(soundFiles).length;
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.responseType = 'arraybuffer';
    req.onload = function(response) {
        if (req.status == 200) {
            audioCtx.decodeAudioData(req.response, function (buffer) {
                soundLibrary[key] = buffer;
                // we assume that one file will be processed last...
                if (Object.keys(soundLibrary).length == fileCount) {
                    init();
                }
            });
        } else {
            console.log('Problem loading sound file.');
            /**
                Note: We will have to make sure that soundLibrary has
                two sounds in it.  In the case of a single successful
                sound load, we would probably copy that buffer to the
                other slot.
            */
            soundLibrary[key] = false;
            if (Object.keys(soundLibrary).length == fileCount) {
                init();
            }
        }
    };
    req.send();
}

for (var key in soundFiles) {
    if (soundFiles.hasOwnProperty(key)) {
        loadSound(key, soundFiles[key]);
    }
}

/**
    Called when sounds are loaded.
*/
function init() {
    // Create DOM elements for beat display.
    updateBeatDisplay();
    // assign sounds
    var beatBuffer = soundLibrary.tock;
    var subdivisionBuffer = soundLibrary.harshBeepCopy;
    /**
        An object storing sounds and their location within the pattern.
        Location is expressed as a floating-point number between 0.0 and 1.0.
        This will be multiplied by secondsPerBeat to give the offset in
        seconds.

        Syntax: [[buffer1, fraction1], [buffer2, fraction2]]
    */
    var pattern = [[beatBuffer, 0.0]];
    /**
        Flags representing initiation and termination of a count.
    */
    var countJustBegun,
        endSignalled;
    /**
        Stores id for animation frame to control repetition/stop of count.
    */
    var beepFrame = false;
    /**
        How much the first beep will happen after the start
        button is clicked.  We do this partly so that first beat is
        not shortened -- noticeably so on my Samsung Galaxy SIII.
    */
    var startOffset = 0.4;
    var whereInPattern;
    var visualBeats = document.getElementsByClassName('visualbeat');
    var previousBeat = visualBeats.length - 1,
        beat;
    // TODO: create option
    //var accentSecondary = false;
    // default = no subdivision
    var division = 1;
    var playSubdivisions = false;

    var secondsPerBeat;
    /**
        Flag indicating whether we have changed tempo or changed to
        subdivisions or back to beats only.
    */
    var handleRateChange = false;
    /**
        Local tempo; needed b/c we only change tempo by the pattern
        statement, though the user can request a change at any time.
    */
    var patternSeconds,
        patternStartTime;

    var newNoteEntry,
        lastNoteTime,
        newNoteTime;

    var tempoTapperArray = [];

    /*************************** FUNCTIONS *****************************/

    function setSecondsPerBeat() {
        var val = getNormalizedInput(bpm.value);
        secondsPerBeat = 60/val;
        if (haveLocalStorage) {
            localStorage.setItem('bpm', JSON.stringify(val));
        }
    }

    function resetPattern() {
        pattern = [[beatBuffer, 0.0]];
        whereInPattern = 0; // why needed? set to 0 in beepFunction ...
    }

    function updatePattern() {
        resetPattern();
        if (division > 1) {
            for(var i = 1; i < division; i++) {
                pattern.push([subdivisionBuffer, i * 1/division]);
            }
        }
    }

    function toggleSound() {
        muted = !muted;
        mute.classList.toggle('muted');
        // So spacebar can be used right after mouseclick
        mute.blur();
        setStoredVariable('muted', muted);
    }

    /**
        Create visual representation of beat.

        Currently, subdivisions are not shown.
    */
    function updateDisplay() {
        /**
            Show new beat.

            Check: If endSignalled and we are on a subdivision other than last,
            we don't want to show anything.  Instead we want to hold and
            erase the current beat.
        */
        visualBeats[beat].style.backgroundColor = 'red';
        /**
            Hide the previous beat.

            We shouldn't need to check previousBeat's value here.
            Somehow, it occasionally ends up being too large when
            downsizing...
        */
        if (previousBeat < beatCount.value) {
            visualBeats[previousBeat].style.backgroundColor = 'white';
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
            setTimeout(function() {
                visualBeats[finalBeat].style.backgroundColor = 'white';
            }, secondsPerBeat * 1000);
        }
    }

    function addBeatBubble() {
        var newBubble = document.createElement('div');
        newBubble.setAttribute('class', 'visualbeat');
        beatBubbles.appendChild(newBubble);
    }

    function removeBeatBubble() {
        beatBubbles.removeChild(beatBubbles.lastElementChild);
    }
    /**
        Add or remove beat bubbles when a new size is selected.
    */
    function updateBeatDisplay() {
        var vbs = document.getElementsByClassName('visualbeat');
        var vbsCount = vbs.length;
        var vbsRequested = beatCount.value;
        if (vbsCount < vbsRequested) {
            for (var i = 0; i < vbsRequested - vbsCount; i++) {
                addBeatBubble();
            }
        } else if (vbsCount > vbsRequested) {
            for (var j = 0; j < vbsCount - vbsRequested; j++) {
                removeBeatBubble();
            }
        }
        setStoredVariable('numberOfBeats', vbsRequested);
    }

    /**
        This function handles audio scheduling and updates the display
        when it is time to change beats.

        Note: Visuals are out of sync with audio scheduling, since
        screen updates are done "in the present," and sounds
        are prepared for the future.  After scheduling the
        last *tock*, we continue to watch the time in order
        to call a screen update when the last sound arrives.

        TODO: if possible, simplify this.
    */
    function beepFunction() {
        /**
            As soon as possible after a note starts playing, schedule
            the next one.

            Note: if the tempo gets really really fast, condition
            below will always be true.  Current time will drift from
            last note time.  Notes will be scheduled further and
            further in the past (meaning that they will sound in
            the present).  (Moot now that tempo input is limited.)
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
                Advance beat and previousBeat.  (Beat is used to
                fill in bubbles, previousBeat to clear them.)
            */
            if (!endSignalled && whereInPattern == pattern.length - 1) {
                if (beat === visualBeats.length - 1) {
                    previousBeat = visualBeats.length - 1;
                    beat = 0;
                } else {
                    previousBeat = beat;
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
                var gain = (beat === 0 && whereInPattern === 0 && accentDownbeat) ? 3.0 : 1.0;
                scheduleSound(newNoteEntry[0], newNoteTime, gain);

                if (countJustBegun) {
                    countJustBegun = false;
                }

                lastNoteTime = newNoteTime;
            }
        }

        beepFrame = requestAnimationFrame(beepFunction);
    }


    /************************ EVENT HANDLERS **************************/

    on.onclick = function() {
        setSecondsPerBeat();
        /**
            We only honor the first click of start button.  While count
            is in progress, all clicks are ignored.
        */
        if (!beepFrame) {
            countJustBegun = true;
            endSignalled = false;
            /**
                Set beat to last beat of count.  It will be incremented
                to 0 when beepFunction is called.
            */
            beat = visualBeats.length - 1;
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
    bpm.onchange = function() {
        setSecondsPerBeat();
        handleRateChange = true;
    };

    /**
        OPTIONS
    */

    // Downbeat accent
    downbeatAccentToggle.onchange = function() {
        accentDownbeat = this.checked;
        setStoredVariable('accentDownbeat', accentDownbeat);
    };

    // Show beats
    beatVisibilityToggle.onchange = function() {
        beatVisible = this.checked;
        beatBubbles.classList.toggle('hide-beats');
        setStoredVariable('beatVisible', beatVisible);
    };

    /**
        Subdivide
    */
    subdivide.onclick = function() {
        playSubdivisions = !playSubdivisions; // toggle

        if (playSubdivisions) {
            division = divisions.value;
            subdivide.innerHTML = 'subdivide off';
        } else {
            resetPattern();
            division = 1;
            subdivide.innerHTML = 'subdivide';
        }

        handleRateChange = true;
    };

    divisions.onchange = function() {
        division = divisions.value;
        if (playSubdivisions) {
            handleRateChange = true;
        }
    };

    beatCount.onchange = function() {
        /**
            When decreasing the length of the measure, the current
            beat may be too large.  Resetting to zero (downbeat) is
            the only sensible option.  We aren't concerned about
            previousBeat in this case, because any bubble that would
            be filled in is removed.
        */
        if (beat > this.value - 1) {
            beat = 0;
        }
        updateBeatDisplay();
    };

    /**
        SOUND

        Pressing mute/unmute button or spacebar toggles sound.

        Spacebar usually reserved for start/stop -- better choice
        for mute/unmute?

        TEMPO TAPPER

        Tapping on 't' 5 times in a new tempo will change the
        metronome's rate.
    */
    mute.onclick = toggleSound;

    function setTappedTempo(ev) {
        ev.preventDefault();
        var tapTime = audioCtx.currentTime;
        /**
            If there have been more than four seconds since the
            last "tap," assume that previous sequence has been
            left incomplete and begin anew.
        */
        if (tempoTapperArray &&
            tapTime - tempoTapperArray[tempoTapperArray.length - 1] > 4) {
            tempoTapperArray = [tapTime];
        } else {
            tempoTapperArray.push(tapTime);
            if (tempoTapperArray.length == TAPS_TO_SET_TEMPO) {
                var deltas = [];
                for(var i = 1; i < TAPS_TO_SET_TEMPO; i++) {
                    deltas.push(tempoTapperArray[i] - tempoTapperArray[i - 1]);
                }
                var avg = deltas.reduce(function (a, b) {
                    return a + b;
                }) / (TAPS_TO_SET_TEMPO - 1);
                bpm.value = Math.round(60 / avg);
                setSecondsPerBeat();
                handleRateChange = true;
                tempoTapperArray = [];
            }
        }
    }

    document.body.onkeyup = function(ev){
        /** MUTE/UNMUTE **/
        if (ev.keyCode == 32) {
            toggleSound();
        }
        /** TEMPO TAPPER **/
        if (ev.keyCode == 84) {
            setTappedTempo(ev);
        }
    };

    tempoTapTarget.onclick = setTappedTempo;

    tempoTapTarget.touchstart = setTappedTempo;
}

function scheduleSound(buffer, time, gain) {
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = (muted) ? 0.0 : gain;
    bufferSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    bufferSource.start(time);
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
