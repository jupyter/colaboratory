/*
 *  /MathJax/jax/output/HTML-CSS/autoload/mmultiscripts.js
 *
 *  @license
 *  Copyright (c) 2009-2013 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

MathJax.Hub.Register.StartupHook("HTML-CSS Jax Ready",function(){var c="2.3";var a=MathJax.ElementJax.mml,b=MathJax.OutputJax["HTML-CSS"];a.mmultiscripts.Augment({toHTML:function(K,I,C){K=this.HTMLcreateSpan(K);var Q=this.HTMLgetScale();var m=b.createStack(K),f;var k=b.createBox(m);if(this.data[this.base]){var l=this.data[this.base].toHTML(k);if(C!=null){this.data[this.base].HTMLstretchV(k,I,C)}else{if(I!=null){this.data[this.base].HTMLstretchH(k,I)}}b.Measured(l,k)}else{k.bbox=this.HTMLzeroBBox()}var O=b.TeX.x_height*Q,B=b.TeX.scriptspace*Q*0.75;var A=this.HTMLgetScripts(m,B);var n=A[0],e=A[1],x=A[2],j=A[3];var g=this.HTMLgetScale();for(var L=1;L<this.data.length;L++){if(this.data[L]&&this.data[L].spanID){g=this.data[L].HTMLgetScale();break}}var F=b.TeX.sup_drop*g,E=b.TeX.sub_drop*g;var y=k.bbox.h-F,w=k.bbox.d+E,P=0,H;if(k.bbox.ic){P=k.bbox.ic}if(this.data[this.base]&&(this.data[this.base].type==="mi"||this.data[this.base].type==="mo")){if(this.data[this.base].data.join("").length===1&&k.bbox.scale===1&&!this.data[this.base].Get("largeop")){y=w=0}}var J=this.getValues("subscriptshift","superscriptshift"),G=this.HTMLgetMu(K);J.subscriptshift=(J.subscriptshift===""?0:b.length2em(J.subscriptshift,G));J.superscriptshift=(J.superscriptshift===""?0:b.length2em(J.superscriptshift,G));var o=0;if(x){o=x.bbox.w+P}else{if(j){o=j.bbox.w-P}}if(o<0){o=0}b.placeBox(k,o,0);if(!e&&!j){w=Math.max(w,b.TeX.sub1*Q,J.subscriptshift);if(n){w=Math.max(w,n.bbox.h-(4/5)*O)}if(x){w=Math.max(w,x.bbox.h-(4/5)*O)}if(n){b.placeBox(n,o+k.bbox.w+B-P,-w)}if(x){b.placeBox(x,0,-w)}}else{if(!n&&!x){f=this.getValues("displaystyle","texprimestyle");H=b.TeX[(f.displaystyle?"sup1":(f.texprimestyle?"sup3":"sup2"))];y=Math.max(y,H*Q,J.superscriptshift);if(e){y=Math.max(y,e.bbox.d+(1/4)*O)}if(j){y=Math.max(y,j.bbox.d+(1/4)*O)}if(e){b.placeBox(e,o+k.bbox.w+B,y)}if(j){b.placeBox(j,0,y)}}else{w=Math.max(w,b.TeX.sub2*Q);var z=b.TeX.rule_thickness*Q;var M=(n||x).bbox.h,N=(e||j).bbox.d;if(x){M=Math.max(M,x.bbox.h)}if(j){N=Math.max(N,j.bbox.d)}if((y-N)-(M-w)<3*z){w=3*z-y+N+M;F=(4/5)*O-(y-N);if(F>0){y+=F;w-=F}}y=Math.max(y,J.superscriptshift);w=Math.max(w,J.subscriptshift);if(e){b.placeBox(e,o+k.bbox.w+B,y)}if(j){b.placeBox(j,o+P-j.bbox.w,y)}if(n){b.placeBox(n,o+k.bbox.w+B-P,-w)}if(x){b.placeBox(x,o-x.bbox.w,-w)}}}this.HTMLhandleSpace(K);this.HTMLhandleColor(K);return K},HTMLgetScripts:function(p,q){var o,d,e=[];var n=1,g=this.data.length,f=0;for(var h=0;h<4;h+=2){while(n<g&&this.data[n].type!=="mprescripts"){for(var l=h;l<h+2;l++){if(this.data[n]&&this.data[n].type!=="none"){if(!e[l]){e[l]=b.createBox(p);e[l].bbox=this.HTMLemptyBBox({});if(f){b.createBlank(e[l],f);e[l].bbox.w=e[l].bbox.rw=f}}this.data[n].toHTML(e[l]);this.HTMLcombineBBoxes(this.data[n],e[l].bbox)}n++}d=e[h];o=e[h+1];if(d&&o){if(d.bbox.w<o.bbox.w){b.createBlank(d,o.bbox.w-d.bbox.w);d.bbox.w=o.bbox.w;d.bbox.rw=Math.max(d.bbox.w,d.bbox.rw)}else{if(d.bbox.w>o.bbox.w){b.createBlank(o,d.bbox.w-o.bbox.w);o.bbox.w=d.bbox.w;o.bbox.rw=Math.max(o.bbox.w,o.bbox.rw)}}}if(d){f=d.bbox.w}else{if(o){f=o.bbox.w}}}n++;f=0}for(l=0;l<4;l++){if(e[l]){e[l].bbox.w+=q;e[l].bbox.rw=Math.max(e[l].bbox.w,e[l].bbox.rw);this.HTMLcleanBBox(e[l].bbox)}}return e},HTMLstretchH:a.mbase.HTMLstretchH,HTMLstretchV:a.mbase.HTMLstretchV});MathJax.Hub.Startup.signal.Post("HTML-CSS mmultiscripts Ready");MathJax.Ajax.loadComplete(b.autoloadDir+"/mmultiscripts.js")});

