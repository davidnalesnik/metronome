Metronome
=========

A metronome which works in a web browser.

### Requirements

The browser used must support the Web Audio API.  A list of such browsers
can be found [here](http://caniuse.com/#feat=audio-api).

Run on a remote or local server.

### Features

* tempos from 1 to 250 beats per minute are supported
* tempo may be entered in the input box or using the "tempo tapper" (see below)
* beat may be subdivided in 2, 3, or 4 parts
* a variable number of beats are displayed along with sound
* beat display may be turned off
* sound may be muted
* beats may be accented (by sound choice) in any pattern
* a variety of sounds may be assigned to ordinary beats, accented downbeats,
   other accented beats, and subdivisions
* adjustments in tempo, subdivision, accents, sounds used, etc., may be
   made while the metronome is ticking
* various settings (for example, tempo and mute) are remembered between
   sessions

### Using the tempo tapper

To set the tempo, tap `t` on the keyboard, or tap/click on the circle
containing "T" on the metronome body.  Do this five times in the tempo
you want.

### Options menu

A variety of settings are found on a sliding menu opened and closed by
the arrow at the top left.

### Known issues

The browser window must stay open while the metronome is in operation.

### Resources

* [A Tale of Two Clocks - Scheduling Web Audio with Precision](http://www.html5rocks.com/en/tutorials/audio/scheduling/)
