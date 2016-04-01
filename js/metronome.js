//beep = document.getElementById('beep');

//on = document.getElementById('start');
//off = document.getElementById('stop');

//var beeping;

/*on.onclick = function() {
    clearInterval(beeping);
    var bpm = document.getElementById('bpm').value;
    var ms = clickTime(bpm);
    beeping = setInterval(function() {
    beep.currentTime = 0;
    beep.play();
    }, ms);
    };

    off.onclick = function() {
    clearInterval(beeping);
    };

    // Stop metronome if user changes tabs or hides window. Otherwise, browser may
    // run process at a different rate.  See
    //http://stackoverflow.com/questions/15871942/how-do-browsers-pause-change-javascript-when-tab-or-window-is-not-active
    document.addEventListener('visibilitychange', function(){
    clearInterval(beeping);
    });

    // convert beats per minute to milliseconds per beat
    function clickTime(bpm) {
    return 60000/bpm;
    }

/*************************************************************/
var on = document.getElementById('start');
var off = document.getElementById('stop');
var inputBox = document.querySelector('input');

var beepingStarted = false;
var secondsPerBeep;

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

var request = new XMLHttpRequest();
request.open('GET', 'Beep.mp3', true);
request.responseType = 'arraybuffer';

request.onload = function () {
    audioCtx.decodeAudioData(request.response, function (buffer) {
        /**
            If the metronome is already going, pressing the start button
            will simply update the rate as the beep continues.
        */
        on.onclick = function() {
            setSecondsPerBeat();
            if (!beepingStarted) {
                beepingStarted = true;
                playBeepLoop(buffer, audioCtx.currentTime, secondsPerBeep);
            }
        };
        /**
            Set a new speed.
        */
        inputBox.onchange = function() {
            setSecondsPerBeat()
        };
        off.onclick = function() {
            beepingStarted = false;
        };
    });
};

request.send();


function setSecondsPerBeat() {
    var beatsPerMinute = document.getElementById('bpm').value;
    secondsPerBeep = 60/beatsPerMinute;
}

function playBeepLoop(buffer, time) {
    if (beepingStarted) {
        var bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = buffer;
        bufferSource.connect(audioCtx.destination);
        bufferSource.start(time);
        /**
            When first beep has played, schedule another one.  We do this
            so that metronome is responsive to 'stop' button and rate
            changes.  (There is some sluggishness as a further beep has already
            been scheduled when user presses stop--unless 'stop' has been
            pressed while beep is in progress!)
        */
        bufferSource.onended = function() {
            playBeepLoop(buffer, time + secondsPerBeep, secondsPerBeep);
        };
    };
}
