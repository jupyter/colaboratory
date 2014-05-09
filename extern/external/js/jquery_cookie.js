/*

 Cookie plugin

 Copyright (c) 2006 Klaus Hartl (stilbuero.de)
 Dual licensed under the MIT and GPL licenses:
 http://www.opensource.org/licenses/mit-license.php
 http://www.gnu.org/licenses/gpl.html

*/
jQuery.cookie=function(d,c,a){if("undefined"!=typeof c){a=a||{};null===c&&(c="",a.expires=-1);var b="";a.expires&&("number"==typeof a.expires||a.expires.toUTCString)&&("number"==typeof a.expires?(b=new Date,b.setTime(b.getTime()+864E5*a.expires)):b=a.expires,b="; expires="+b.toUTCString());var e=a.path?"; path="+a.path:"",f=a.domain?"; domain="+a.domain:"";a=a.secure?"; secure":"";document.cookie=[d,"=",encodeURIComponent(c),b,e,f,a].join("")}else{c=null;if(document.cookie&&""!=document.cookie)for(a=
document.cookie.split(";"),b=0;b<a.length;b++)if(e=jQuery.trim(a[b]),e.substring(0,d.length+1)==d+"="){c=decodeURIComponent(e.substring(d.length+1));break}return c}};
