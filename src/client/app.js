define(function (require) {

  'use strict';

  var utils = require('src/client/socket_utils');
  var modeError = "Please check mode. Value should be 'analog', 'digital', or 'pwm'";
  var _board;
  var eventQ = [];

  p5.Board = function (port, type){
    this.port = port;
    this.type = type.toLowerCase() || 'arduino';
    // Will be set when board is connected
    this.ready = false;
  };

  p5.Pin = function(num, mode, direction){
    this.pin = num;
    this.mode = mode ? mode.toLowerCase() : 'digital';
    this.direction = direction ? direction.toLowerCase() : 'output';

    this.write = function() { throw new Error(modeError) },
    this.read = function() { throw new Error(modeError) }
  };

  p5.board = function (port, type){
    console.log('p5.board called');
    _board = new p5.Board(port, type);

    // also emit board object & listen for return
    utils.boardInit(port, type);
    utils.socket.on('board ready', function(){
     _board.ready = true;
     eventQ.forEach(function(el){
      el.func.apply(null, el.args);
     });
    });
     
    return _board;
  };

  p5.pin = function(num, mode, direction){
    var _pin = new p5.Pin(num, mode, direction);
    var init = utils.pinInit(num, mode, direction);
    var setVal = function(data){
          this.val = data.val;
    };

    _board.ready ? init() 
                 : eventQ.push({
                    func: init,
                    args: []
                  }); 
    
    // add basic methods based on mode
    if (_pin.mode === 'digital' || _pin.mode === 'analog'){
      _pin.write = function(arg){
        var fire = utils.socketGen(_pin.mode, 'write', _pin.pin);
        _board.ready ? fire(arg) : eventQ.push({func: fire, args: [arg]});
        return function nextWrite(arg){ fire(arg); return nextWrite };
      };

      _pin.read = function(arg){
        var fire = utils.socketGen(_pin.mode, 'read', _pin.pin);
         _board.ready ? fire(arg) : eventQ.push({func: fire, args: [arg]});

        utils.socket.on('return val', setVal.bind(this));
        return function nextRead(arg){ fire(arg); return nextRead };
      };
    } else if (_pin.mode === 'pwm'){
      _pin.write = function(arg){
        var fire = utils.socketGen('analog', 'write', _pin.pin, arg);
         _board.ready ? fire(arg) : eventQ.push({func: fire, args: [arg]});
         return function nextWrite(arg){ fire(arg); return nextWrite };
      };

      _pin.read = function(arg){
        var fire = utils.socketGen('analog', 'read', _pin.pin);
         _board.ready ? fire(arg) : eventQ.push({func: fire, args: [arg]});
         
         utils.socket.on('return val', setVal.bind(this));
         return function nextRead(arg){ fire(arg); return nextRead };
      };

    } else {
      throw new Error(modeError);
    }

    return _pin;
  };

});