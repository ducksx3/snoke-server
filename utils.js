module.exports = {
  makeid,
  randomColour,
}
var os = require("os");
function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 1; i < length; i++ ) {
      result +=  characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   podName = os.hostname();
   final = podName.substring(podName.lastIndexOf('-') + 1);
   //final = final.replace(/\D/g, '');
   result = final+'x'+result;
   return result;
}


function randomColour(){
   //#0df10b - green snoke
   let colour = '#';
   for (let i = 0; i < 6; i++){
      const random = Math.random();
      const bit = (random * 16) | 0;
      colour += (bit).toString(16);
   };
   return colour;
}
// source - https://www.tutorialspoint.com/generating-random-hex-color-in-javascript
