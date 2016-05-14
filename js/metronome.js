/**
    TODO:
    - collect more sounds
    - remember more settings between sessions (meter, subdivision)
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
    metricAccentToggles = document.getElementById('metric-accent-toggles'),
    on = document.getElementById('start-button'),
    off = document.getElementById('stop-button'),
    tempoTapTarget = document.getElementById('tempo-tap-target'),
    subdivide = document.getElementById('subdivide-button'),
    divisions = document.getElementById('divisions'),
    beatBubbles = document.getElementById('beat-bubbles'),
    visualBeats = document.getElementsByClassName('beat-bubble'),
    beatCountSelect = document.getElementById('beat-count-select'),
    bpm = document.getElementById('tempo-input'),
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
    BEAT_VISIBLE = true,
    SOUND_ASSOCIATIONS_DEFAULT = {
        'default-sound': 'tock',
        'downbeat-sound': 'beep',
        'secondary-accent-sound': 'cork',
        'subdivision-sound': 'woodblock'
    };

/**
    DATA STORAGE

    If possible, settings persist between sessions.

    We remember the following:
     - whether sound is muted,
     - the tempo,
     - the number of beats,
     - whether beats are displayed,
     - whether downbeats are accented,
     - and sound assignments.

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

beatCountSelect[numberOfBeats - 2].setAttribute('selected', true);

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
    beatBubbles.classList.add('hide');
}

/**
    Initial sound associations
*/
var soundAssociations = initializeStoredVariable('soundAssociations', SOUND_ASSOCIATIONS_DEFAULT);

/**
    LOAD SOUNDS

    Retrieve sounds and store decoded data in soundLibrary object
    with meaningful identifiers. An entry of 'false' indicates an
    unsuccessful load.

    Once all sounds are loaded, we make sure that every type of
    sound (ordinary default beat, accented downbeat, accented
    secondary beat, or subdivision) has a valid assignment.  If
    so, we then call init.

    beep.mp3 derived from
    http://audiosoundclips.com/wp-content/uploads/2011/12/Beep.mp3

    metronome.mp3 derived from clip at
    http://soundbible.com/914-Metronome.html, recorded by Mike Koenig

    woodblock.mp3 derived from "Wood block 10" at
    http://eng.universal-soundbank.com/woodblock.htm

    pop-cork.mp3 derived from clip at http://soundbible.com/533-Pop-Cork.html,
    recorded by Mike Koenig
*/

var soundFiles = {
    tock: 'sounds/metronome.mp3',
    beep: 'sounds/beep.mp3',
    woodblock: 'sounds/woodblock.mp3',
    cork: 'sounds/pop-cork.mp3'
};

var soundLibrary = {};

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
                    checkSoundAssociations();
                }
            });
        } else {
            soundLibrary[key] = false;
            if (Object.keys(soundLibrary).length == fileCount) {
                checkSoundAssociations();
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
    Make sure that classes of sound are associated with files that
    have loaded successfully.

    In case a type is paired with a sound which hasn't loaded,
    we assign it the default 'tock' if possible, the first
    available sound we find if not.  If no sound is available, we
    do not proceed any further.
*/
function getAlternateAssociation(key) {
    // Favor 'tock' as the default
    if (soundLibrary.tock) {
        return 'tock';
    }
    for(var sound in soundLibrary) {
        if (soundLibrary.hasOwnProperty(sound) &&
            soundLibrary[sound]) {
            return sound;
        }
    }
    // A roundabout way of discovering that all sounds didn't load...
    return false;
}

function checkSoundAssociations() {
    var alternate,
        haveAtLeastOneSound = true;
    for (var key in soundAssociations) {
        if (soundAssociations.hasOwnProperty(key)) {
            if (!soundLibrary[soundAssociations[key]]) {
                alternate = getAlternateAssociation(key);
                if (!alternate) {
                    haveAtLeastOneSound = false;
                    break;
                }
                soundAssociations[key] = alternate;
            }
        }
    }

    if (haveAtLeastOneSound) {
        init();
    } else {
        alert('No sounds could be loaded!');
    }
}
/**
    Called when sounds are loaded and associated with sound types.
*/
function init() {
    // Create DOM elements for beat display.
    updateBeatDisplay();
    // Create DOM elements for accented beat selector
    updateAccentedBeatToggles();
    // Add options to sound selection menu.
    populateSoundMenu();

    /**
        An array storing location of events within the repeating pattern
        (a single beat or a beat and its subdivisions).  Location is
        expressed as a floating-point number between 0.0 and 1.0.  This
        will be multiplied by secondsPerBeat to give the offset in
        seconds.
    */
    var pattern = [0.0];
    /**
        Flags representing initiation and termination of a count.
    */
    var countJustBegun,
        endRequested;
    /**
        Flag representing final end of count.  (There is a wrap-up
        after the user requests an end.)
    */
    var wrapUpCount = false;
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
    var whereInBeat;
    var previousBeat = numberOfBeats - 1,
        beat;

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

    var lastNoteTime,
        newNoteTime;

    var tempoTapperArray = [];

    /*************************** FUNCTIONS *****************************/

    /**
        Update soundAssociations object based on selection from the
        sound menu.
    */
    function registerSoundSelection() {
        soundAssociations[this.id] = this.options[this.selectedIndex].value;
        setStoredVariable('soundAssociations', soundAssociations);
    }

    /**
        Build option lists for sound selection.  Select the
        assignments for each role based on soundAssociations
        object.
    */
    function populateSoundMenu() {
        var menuElements = document.getElementsByClassName('sound-menu-element');
        var currentElement,
            soundChoice,
            toSelect;
        for(var i = 0; i < menuElements.length; i++) {
            currentElement = menuElements[i];
            /**
                IMPORTANT: DOM ids and soundAssociation keys MUST match
                for this to work.  Possibly we ought to set ids from this
                object so there is no chance for mistakes to occur.
            */
            toSelect = soundAssociations[currentElement.id];
            for(var sound in soundLibrary) {
                if (soundLibrary.hasOwnProperty(sound) &&
                    soundLibrary[sound]) {
                    soundChoice = document.createElement('option');
                    soundChoice.innerHTML = sound;
                    soundChoice.setAttribute('value', sound);
                    if (sound == toSelect) {
                        soundChoice.setAttribute('selected', 'selected');
                    }
                    currentElement.appendChild(soundChoice);
                }
            }
            currentElement.onchange = registerSoundSelection;
        }
    }

    function setSecondsPerBeat() {
        var val = getNormalizedInput(bpm.value);
        secondsPerBeat = 60/val;
        if (haveLocalStorage) {
            localStorage.setItem('bpm', JSON.stringify(val));
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
        Create visual representation of beat.  Subdivisions are
        not shown.
    */

    function showBeat(b) {
         visualBeats[b].style.backgroundColor = 'red';
    }

    function hideBeat(b) {
        visualBeats[b].style.backgroundColor = 'white';
    }

    /**
        Light the current beat and clear the previous beat.
        When the count is over, clear the current beat.
    */
    function updateDisplay() {
        if (wrapUpCount) {
            hideBeat(beat);
        } else {
            showBeat(beat);
            /**
                If number of beats is reduced, previousBeat may
                be out-of-bounds.
            */
            if (previousBeat < numberOfBeats) {
                hideBeat(previousBeat);
            }
        }
    }

    /**
        Add or remove beat bubbles when a new size is selected.
    */

    function addBeatBubble() {
        var newBubble = document.createElement('div');
        newBubble.setAttribute('class', 'beat-bubble');
        beatBubbles.appendChild(newBubble);
    }

    function removeBeatBubble() {
        beatBubbles.removeChild(beatBubbles.lastElementChild);
    }

    function updateBeatDisplay() {
        var beatsDrawnCount = visualBeats.length;
        if (beatsDrawnCount < numberOfBeats) {
            for (var i = 0; i < numberOfBeats - beatsDrawnCount; i++) {
                addBeatBubble();
            }
        } else if (beatsDrawnCount > numberOfBeats) {
            for (var j = 0; j < beatsDrawnCount - numberOfBeats; j++) {
                removeBeatBubble();
            }
        }
    }

    function updateDownbeatAccent () {
        accentDownbeat = this.checked;
        downbeatAccentToggle.checked = accentDownbeat;
    }

    function updateAccentedBeatToggles() {
        /**
            Right now, whenever we update we start with a blank
            slate.  More efficent to add and subtract as needed.
        */
        metricAccentToggles.innerHTML = '';
        var accentToggle, label;
        for(var i = 0; i < numberOfBeats; i++) {
            label = document.createElement('label');
            label.setAttribute('class', 'beat-label');
            label.innerHTML = i + 1;
            accentToggle = document.createElement('input');
            accentToggle.setAttribute('type', 'checkbox');
            if (i === 0) {
                accentToggle.onchange = updateDownbeatAccent;
                if (accentDownbeat) {
                    accentToggle.setAttribute('checked', true);
                }
            }
            accentToggle.setAttribute('id', i);
            accentToggle.setAttribute('value', i);
            label.appendChild(accentToggle);
            metricAccentToggles.appendChild(label);
        }
    }

    function isBeatAccented(beat) {
        // beat doesn't actually need to be parameter, but let's be safe
        return (beat === 0 && accentDownbeat) ||
        document.getElementById(beat).checked;
    }

    /**
        Return a sound buffer based on metric assignments.
    */
    function getSoundBuffer() {
        // subdivision
        if (whereInBeat !== 0) {
            return soundLibrary[soundAssociations['subdivision-sound']];
        }
        // ordinary beat
        if (!isBeatAccented(beat)) {
            return soundLibrary[soundAssociations['default-sound']];
        }
        // accented beats (downbeat, secondary)
        return (beat === 0) ? soundLibrary[soundAssociations['downbeat-sound']] :
        soundLibrary[soundAssociations['secondary-accent-sound']];
    }

    /**
        Advance beat and previousBeat.  (Beat is used to
        fill in bubbles, previousBeat to clear them.)
    */
    function advanceBeat() {
        previousBeat = beat;
        if (beat === numberOfBeats - 1) {
            beat = 0;
        } else {
            beat++;
        }
    }

    /**
        Build a new beat profile.

        Only call this from beepSequence (i.e., when pattern changes are
        processed) so whereInBeat is always in sync with the beat pattern.
    */
    function updatePattern() {
        pattern = [0.0];
        if (division > 1) {
            for (var i = 1; i < division; i++) {
                pattern.push(i/division);
            }
        }
    }

    /**
        This function schedules single sounds.  The times will
        also be used for visual events.

        Notes are scheduled one at a time to allow for quick response
        to user input.
    */
    function beep() {
        if (wrapUpCount) {
            wrapUpCount = false;
            cancelAnimationFrame(beepFrame); // necessary?
            beepFrame = false;
        } else {
            /**
                Advance beat and where we are in beat pattern.

                Process any changes of division and tempo when
                beat advances.
            */
            if (whereInBeat === pattern.length - 1) {
                whereInBeat = 0;
                if (!endRequested) {
                    advanceBeat();
                }
                /**
                    If a change is requested, the arrival of the new
                    beat pattern statement happens according to the
                    old tempo.  Then the new settings take effect.

                    Don't delay the very first beat by the beat
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
                whereInBeat++;
            }

            newNoteTime = patternStartTime + pattern[whereInBeat] * patternSeconds;
            /**
                Select volume of note based on accent pattern.

                No appreciable effect on Firefox 44.0.2 or 46.0.1.  Values
                0-1 have obvious effect, but values > 1 don't seem to
                increase the volume at all.  Very high values distort
                sound.  Possibly there should be an option to use a
                different sound as an accent?
            */
            //var gain = ((whereInBeat === 0) &&
            //((beat === 0 && accentDownbeat) || isBeatAccented(beat))) ? 3.0 : 1.0;

            if (countJustBegun) {
                countJustBegun = false;
            }

            if (endRequested) {
                endRequested = false;
                wrapUpCount = true;
            } else {
                var currentBuffer = getSoundBuffer();
                scheduleSound(currentBuffer, newNoteTime, 1.0);
            }

            lastNoteTime = newNoteTime;
        }
    }
    /**
        Oversee the audio and visual aspects of a count.

        Right now, audio scheduling and video updates are in lockstep:
        as soon as the context reaches a scheduled time, we update
        the display and schedule another event.

        Note that visuals are one beat out of sync with audio scheduling,
        since screen updates are done "in the present," and sounds are
        prepared for the future.

        When the user requests a stop, we have already scheduled a time
        for the last sound and the last beat *appearance*.  We schedule
        one more time to use for clearing the last beat on the screen.
    */
    function beepSequence() {
        /**
            When the current time reaches a scheduled time,
            update the display and schedule another note.
        */
        if (audioCtx.currentTime >= lastNoteTime){
            /**
                If we have just begun a count, we don't want to call
                display because the beginning cycle schedules a future
                audio event.

                Checking whether whereInBeat is 0 limits display to
                beats rather than every subdivision.
            */
            if ((!countJustBegun && whereInBeat === 0) || wrapUpCount) {
                updateDisplay();
            }
            // sound
            beep();
        }
        // beepFrame will be false when ending
        return !beepFrame || requestAnimationFrame(beepSequence);
    }


    /************************ EVENT HANDLERS **************************/

    on.onclick = function() {
        /**
            This is necessary on Safari(tested on iPhone 5S, iOS 9.3.1).
            See https://bugs.chromium.org/p/chromium/issues/detail?id=159359
            audioCtx.currentTime stays locked at 0 until some API call
            is made, so we make a dummy gainNode here.

            Also, it seems we need to do this in response to a user
            event, hence placement in event handler.
        */
        audioCtx.createGain();
        setSecondsPerBeat();
        /**
            We only honor the first click of start button.  While count
            is in progress, all clicks are ignored.
        */
        if (!beepFrame) {
            countJustBegun = true;
            endRequested = false;
            /**
                Set beat to last beat of count.  It will be incremented
                to 0 when beepSequence is called.
            */
            beat = numberOfBeats - 1;
            patternSeconds = secondsPerBeat;
            patternStartTime = audioCtx.currentTime + startOffset;
            // set to -1 so beepSequence loop triggers immediately
            lastNoteTime = -1;
            /**
                Set to last note of the pattern.  Subdivisions are
                processed as a change, and beepSequence only allows
                changes when we reach the last note of a pattern.  We
                will start with the right note b/c whereInBeat is
                set to 0 after changes are processed.
            */
            whereInBeat = pattern.length - 1;
            beepFrame = requestAnimationFrame(beepSequence);
        }
    };

    off.onclick = function() {
        endRequested = true;
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
        // update metrical accent selector
        document.getElementById('0').checked = accentDownbeat;
    };

    // Show beats
    beatVisibilityToggle.onchange = function() {
        beatVisible = this.checked;
        beatBubbles.classList.toggle('hide');
        setStoredVariable('beatVisible', beatVisible);
    };

    // Show/hide selected side-menu options
    var collection = document.getElementsByClassName('click-to-hide');
    /**
        For simplicity, we assume that the element to hide is the
        next one at the same level.  We could add a class 'hideable'
        and look for that class among the parent's children if we ever
        need to break the pattern.  Or, we could surround the hideable
        element with <label></label> instead of <a></a>
    */
    function toggleOptionVisibility() {
        this.nextElementSibling.classList.toggle('hide');
    }

    for (var i = 0; i < collection.length; i++) {
        collection[i].onclick = toggleOptionVisibility;
    }
    /**
        Subdivide
    */
    subdivide.onclick = function() {
        playSubdivisions = !playSubdivisions; // toggle

        if (playSubdivisions) {
            division = divisions.value;
            subdivide.innerHTML = 'subdivide off';
        } else {
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

    beatCountSelect.onchange = function() {
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
        numberOfBeats = beatCountSelect.value;
        setStoredVariable('numberOfBeats', numberOfBeats);
        updateBeatDisplay();
        updateAccentedBeatToggles();
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
    var gainNode = audioCtx.createGain();
    gainNode.gain.value = (muted) ? 0.0 : gain;
    var bufferSource = audioCtx.createBufferSource();
    bufferSource.buffer = buffer;
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
