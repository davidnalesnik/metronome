(function () {

    // create AudioContext
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        var audioCtx = new window.AudioContext();
    } catch (e) {
        alert('Web Audio API support required.');
    }

    // DOM selectors
    var sideMenuToggle = document.getElementById('side-menu-toggle'),
        downbeatAccentToggle = document.getElementById(
            'downbeat-accent-toggle'),
        beatVisibilityToggle = document.getElementById(
            'beat-visibility-toggle'),
        metricAccentToggles = document.getElementById(
            'metric-accent-toggles'),
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

    // default settings
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

    /*
        DATA STORAGE

        We attempt to remember the following:
         - whether sound is muted,
         - the tempo,
         - the number of beats,
         - whether beats are displayed,
         - whether downbeats are accented,
         - and sound assignments.

        If the browser does not support the Web Storage API, use default values.

        TODO: remember more settings (meter, subdivision)
    */

    // Can we store data between browser sessions?  Function from
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    function storageAvailable(type) {
        try {
            var storage = window[type],
                x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    }

    var haveLocalStorage = storageAvailable('localStorage');

    function setStoredVariable(name, val) {
        if (haveLocalStorage) {
            localStorage.setItem(name, JSON.stringify(val));
        }
    }

    // Use at the beginning of a session for managing a variable that may be
    // in storage.  Returns a value so may be used as an initializer.
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

    // Use at the beginning of a session for setting DOM attributes to
    // values that may be in storage.
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

    // Mute/unmute

    var muted = initializeStoredVariable('muted', MUTED_DEFAULT);

    if (muted) {
        mute.classList.add('muted');
    }

    function toggleSound() {
        muted = !muted;
        mute.classList.toggle('muted');
        // So spacebar can be used right after mouseclick
        // event listener for spacebar added in metronome
        mute.blur();
        setStoredVariable('muted', muted);
    }

    mute.onclick = toggleSound;

    // initial tempo
    initializeStorableProperty(bpm, 'bpm', 'value', MM_DEFAULT);

    // beats

    var numberOfBeats = initializeStoredVariable('numberOfBeats',
        BEAT_COUNT_DEFAULT);

    var beat = numberOfBeats - 1;

    beatCountSelect[numberOfBeats - 2].setAttribute('selected', true);

    // Create visual display of beats on metronome body.  Add or remove
    // bubbles when a new size is selected.

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

    updateBeatDisplay();

    beatCountSelect.onchange = function () {
        // When decreasing the length of the measure, the current beat may be
        // too large.  Resetting to zero (downbeat) is the only sensible option.
        // We aren't concerned about previousBeat in this case, because any
        // bubble that would be filled in is removed.
        if (beat > this.value - 1) {
            beat = 0;
        }
        numberOfBeats = beatCountSelect.value;
        setStoredVariable('numberOfBeats', numberOfBeats);
        updateBeatDisplay();
        updateAccentedBeatToggles();
    };

    // visibility or beats on metronome body

    var beatVisible = initializeStoredVariable('beatVisible', BEAT_VISIBLE);

    beatVisibilityToggle.onchange = function () {
        beatVisible = this.checked;
        beatBubbles.classList.toggle('hide');
        setStoredVariable('beatVisible', beatVisible);
    };

    beatVisibilityToggle.checked = beatVisible;

    if (!beatVisible) {
        beatBubbles.classList.add('hide');
    }


    // accents

    var accentDownbeat = initializeStoredVariable('accentDownbeat',
        ACCENT_DOWNBEAT);

    function updateDownbeatAccent() {
        accentDownbeat = this.checked;
        downbeatAccentToggle.checked = accentDownbeat;
    }

    downbeatAccentToggle.checked = accentDownbeat;

    downbeatAccentToggle.onchange = function () {
        accentDownbeat = this.checked;
        setStoredVariable('accentDownbeat', accentDownbeat);
        // update metrical accent selector
        document.getElementById('0').checked = accentDownbeat;
    };

    // Create DOM elements for accented beat selector

    function updateAccentedBeatToggles() {
        // Start with a blank when updating.  Maybe add and subtract as needed?
        metricAccentToggles.innerHTML = '';
        var accentToggle, label;
        for (var i = 0; i < numberOfBeats; i++) {
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

    updateAccentedBeatToggles();


    // side menu visibility
    sideMenuToggle.onclick = function (ev) {
        this.parentNode.classList.toggle('show-side-menu');
    };

    // Show/hide selected side-menu options

    var collection = document.getElementsByClassName('click-to-hide');

    function toggleOptionVisibility() {
        // assume that the element to hide is next at the same level
        this.nextElementSibling.classList.toggle('hide');
    }

    for (var i = 0; i < collection.length; i++) {
        collection[i].onclick = toggleOptionVisibility;
    }


    /*
        LOAD SOUNDS

        Retrieve sounds and store decoded data in soundLibrary object
        with meaningful identifiers. An entry of 'false' indicates an
        unsuccessful load.

        Once all sounds are loaded, we make sure that every type of
        sound (ordinary default beat, accented downbeat, accented
        secondary beat, or subdivision) has a valid assignment.  If
        so, we then call metronome.

        beep.mp3 derived from
        http://audiosoundclips.com/wp-content/uploads/2011/12/Beep.mp3

        metronome.mp3 derived from clip at
        http://soundbible.com/914-Metronome.html, recorded by Mike Koenig

        woodblock.mp3 derived from "Wood block 10" at
        http://eng.universal-soundbank.com/woodblock.htm

        pop-cork.mp3 derived from clip at http://soundbible.com/533-Pop-Cork.html,
        recorded by Mike Koenig

        TODO: collect more sounds
    */

    var soundFiles = {
        tock: 'sounds/metronome.mp3',
        beep: 'sounds/beep.mp3',
        woodblock: 'sounds/woodblock.mp3',
        cork: 'sounds/pop-cork.mp3'
    };

    var soundAssociations = initializeStoredVariable('soundAssociations',
        SOUND_ASSOCIATIONS_DEFAULT);

    // Given an object associating keys with file names, return another object
    // replacing values with AudioBuffers, or 'false' for unsuccessful loads.
    // When loading is completed, call procedures to fix associations of sound
    // types with unavailable buffers and create metronome functionality.  If
    // no sounds are available, proceed no further.
    function buildSoundLibrary(fileArray) {
        var fileCount = Object.keys(fileArray).length,
            loadCount = 0,
            failCount = 0;
        var library = {};

        function loadSound(key, url) {
            var req = new XMLHttpRequest();
            req.open('GET', url);
            req.responseType = 'arraybuffer';
            req.onload = function (response) {
                if (req.status == 200) {
                    audioCtx.decodeAudioData(req.response, function (
                        buffer) {
                        library[key] = buffer;
                        loadCount++;
                        if (loadCount == fileCount) {
                            if (failCount) {
                                checkSoundAssociations(library);
                            }
                            metronome();
                        }
                    });
                } else {
                    library[key] = false;
                    loadCount++;
                    failCount++;
                    if (failCount == fileCount) {
                        alert('No sounds could be loaded!');
                    } else if (loadCount == fileCount) {
                        checkSoundAssociations(library);
                        metronome();
                    }
                }
            };
            req.send();
        }

        for (var sound in fileArray) {
            if (fileArray.hasOwnProperty(sound)) {
                loadSound(sound, fileArray[sound]);
            }
        }
        return library;
    }

    var soundLibrary = buildSoundLibrary(soundFiles);

    // Make sure that classes of sound are associated with files that have
    // loaded successfully.  Use the default 'tock' if possible, the first
    // available sound we find if not.
    function getAlternateAssociation(library, preference) {
        if (library[preference]) {
            return preference;
        }
        for (var sound in library) {
            if (library.hasOwnProperty(sound) && library[sound]) {
                return sound;
            }
        }
        // all sounds didn't load
        return false;
    }

    function checkSoundAssociations(library) {
        for (var key in soundAssociations) {
            if (soundAssociations.hasOwnProperty(key) && !library[
                    soundAssociations[key]]) {
                soundAssociations[key] = getAlternateAssociation(
                    library, 'tock');
            }
        }
    }

    /************************* MAIN FUNCTION ****************************/

    function metronome() {
        // array storing location of events within the repeating pattern
        // (a single beat or a beat and its subdivisions), expressed as
        // a number between 0.0 and 1.0
        var pattern = [0.0];

        // flags representing initiation and termination of a count
        var countJustBegun,
            endRequested,
            wrapUpCount = false;

        var beepFrame = false; // animation frame

        // How much the first beep will happen after the start button is
        // clicked.  An offset ensures that first beat is not shortened.
        var startOffset = 0.4;

        var whereInBeat;
        var previousBeat = numberOfBeats - 1;

        var division = 1; // no subdivision
        var playSubdivisions = false;

        var secondsPerBeat;

        // Have we changed tempo or changed to subdivisions or back to beats only?
        var handleRateChange = false;

        // Local tempo.  (We only change tempo by the pattern statement, though
        // the user can request a change at any time.
        var patternSeconds,
            patternStartTime;

        var lastNoteTime,
            newNoteTime;

        var tempoTapperArray = [];


        // update soundAssociations based on selection from the sound menu
        function registerSoundSelection() {
            soundAssociations[this.id] = this.options[this.selectedIndex].value;
            setStoredVariable('soundAssociations', soundAssociations);
        }

        // Build option lists for sound selection.  Select the assignments for
        // each role based on soundAssociations object.
        function populateSoundMenu() {
            var menuElements = document.getElementsByClassName(
                'sound-menu-element');
            var currentElement,
                soundChoice,
                toSelect;
            for (var i = 0; i < menuElements.length; i++) {
                currentElement = menuElements[i];
                // IMPORTANT: DOM ids and soundAssociation keys MUST match
                // for this to work.  Possibly we ought to set ids from this
                // object so there is no chance for mistakes to occur.
                toSelect = soundAssociations[currentElement.id];
                for (var sound in soundLibrary) {
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

        populateSoundMenu();

        // If user input is out of supported bounds, modify it and display.
        function getNormalizedInput(inp) {
            if (inp < MM_MIN || inp > MM_MAX) {
                inp = Math.max(MM_MIN, inp);
                inp = Math.min(inp, MM_MAX);
                // update display with normalized value
                bpm.value = inp;
            }
            return inp;
        }

        function setSecondsPerBeat() {
            var val = getNormalizedInput(bpm.value);
            secondsPerBeat = 60 / val;
            if (haveLocalStorage) {
                localStorage.setItem('bpm', JSON.stringify(val));
            }
        }

        // Create visual representation of beat.  Subdivisions are not shown.

        function showBeat(b) {
            visualBeats[b].style.backgroundColor = 'red';
        }

        function hideBeat(b) {
            visualBeats[b].style.backgroundColor = 'white';
        }

        // Light the current beat and clear the previous beat.  When the count
        // is over, clear the current beat.
        function updateDisplay() {
            if (wrapUpCount) {
                hideBeat(beat);
            } else {
                showBeat(beat);
                // If number of beats is reduced, previousBeat may be out-of-bounds.
                if (previousBeat < numberOfBeats) {
                    hideBeat(previousBeat);
                }
            }
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

        function isBeatAccented(beat) {
            return (beat === 0 && accentDownbeat) ||
                document.getElementById(beat).checked;
        }

        // Return a sound buffer based on metric assignments.
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
            return (beat === 0) ? soundLibrary[soundAssociations[
                    'downbeat-sound']] :
                soundLibrary[soundAssociations['secondary-accent-sound']];
        }

        // advance beat and previousBeat
        function advanceBeat() {
            previousBeat = beat;
            beat = (beat === numberOfBeats - 1) ? 0 : beat + 1;
        }

        // Build a new beat profile.  Only call this from beepSequence (i.e.,
        // when pattern changes are processed) so whereInBeat is always in
        // sync with the beat pattern.
        function updatePattern() {
            pattern = [0.0];
            if (division > 1) {
                for (var i = 1; i < division; i++) {
                    pattern.push(i / division);
                }
            }
        }

        // Schedule single sounds.  Times will also be used for visual events.
        // Notes are scheduled one at a time to allow for quick response to user
        // input.
        function beep() {
            if (wrapUpCount) {
                wrapUpCount = false;
                cancelAnimationFrame(beepFrame); // necessary?
                beepFrame = false;
            } else {
                // Advance beat and where we are in beat pattern.  Process any
                // changes of division and tempo when beat advances.
                if (whereInBeat === pattern.length - 1) {
                    whereInBeat = 0;
                    if (!endRequested) {
                        advanceBeat();
                    }
                    // If a change is requested, the arrival of the new beat
                    // pattern statement happens according to the old tempo.
                    // Then the new settings take effect.  Don't delay the very
                    // first beat by the beat length, though.
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

                newNoteTime = patternStartTime + pattern[whereInBeat] *
                    patternSeconds;
                // Select volume of note based on accent pattern.
                // No appreciable effect on Firefox 44.0.2 or 46.0.1.  Values
                // 0-1 have obvious effect, but values > 1 don't seem to increase
                // the volume at all.  Very high values distort sound.
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

        /*
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
            if (audioCtx.currentTime >= lastNoteTime) {
                // No display with first scheduling pass or subdivisions
                if ((!countJustBegun && whereInBeat === 0) || wrapUpCount) {
                    updateDisplay();
                }
                beep(); // sound
            }
            // beepFrame will be false when ending
            return !beepFrame || requestAnimationFrame(beepSequence);
        }


        /************************ EVENT HANDLERS **************************/

        on.onclick = function () {

            // disregard multiple clicks of start button
            if (!beepFrame) {

                // Dummy gainNode is to get currentTime moving on Safari.  See
                // https://bugs.chromium.org/p/chromium/issues/detail?id=159359
                // We need to do this in response to a user event.
                audioCtx.createGain();

                setSecondsPerBeat();
                countJustBegun = true;
                endRequested = false;

                // Set beat to last beat of count.  It will be incremented to 0
                // when beepSequence is called.
                beat = numberOfBeats - 1;
                patternSeconds = secondsPerBeat;
                patternStartTime = audioCtx.currentTime + startOffset;

                // set so beepSequence loop triggers immediately
                lastNoteTime = -1;

                // Set to last note of the pattern.  Subdivisions are processed
                // as a change, and beepSequence only allows changes when we
                // reach the last note of a pattern.  We will start with the
                // right note b/c whereInBeat is set to 0 after changes are
                // processed.
                whereInBeat = pattern.length - 1;

                beepFrame = requestAnimationFrame(beepSequence);
            }
        };

        off.onclick = function () {
            endRequested = true;
        };

        // set a new speed
        bpm.onchange = function () {
            setSecondsPerBeat();
            handleRateChange = true;
        };

        // subdivide
        subdivide.onclick = function () {
            playSubdivisions = !playSubdivisions;

            if (playSubdivisions) {
                division = divisions.value;
                subdivide.innerHTML = 'subdivide off';
            } else {
                division = 1;
                subdivide.innerHTML = 'subdivide';
            }

            handleRateChange = true;
        };

        divisions.onchange = function () {
            division = divisions.value;
            if (playSubdivisions) {
                handleRateChange = true;
            }
        };

        // TEMPO TAPPER.  Pressing 't' 5 times or clicking/tapping on the circle
        // on the metronome body containing 'T' in a new tempo will change the
        // metronome's rate.

        function setTappedTempo(ev) {
            ev.preventDefault();
            var tapTime = audioCtx.currentTime;
            // reset after four seconds since the last tap
            if (tempoTapperArray &&
                tapTime - tempoTapperArray[tempoTapperArray.length - 1] > 4
            ) {
                tempoTapperArray = [tapTime];
            } else {
                tempoTapperArray.push(tapTime);
                if (tempoTapperArray.length == TAPS_TO_SET_TEMPO) {
                    var deltas = [];
                    for (var i = 1; i < TAPS_TO_SET_TEMPO; i++) {
                        deltas.push(tempoTapperArray[i] - tempoTapperArray[
                            i - 1]);
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

        tempoTapTarget.onclick = setTappedTempo;

        tempoTapTarget.touchstart = setTappedTempo;

        document.body.onkeyup = function (ev) {
            // MUTE/UNMUTE = spacebar
            if (ev.keyCode == 32) {
                toggleSound();
            }
            // TEMPO TAPPER = 't'
            if (ev.keyCode == 84) {
                setTappedTempo(ev);
            }
        };
    }
})();
