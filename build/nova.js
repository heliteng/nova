'use strict';
(function () {
    var Nova = function Nova(prototype) {
        Nova.Base.chainObject(prototype, Nova.Base);
        var opts = { prototype: prototype };
        if (prototype['extends']) {
            opts['extends'] = prototype['extends'];
        }
        var registerd = document.registerElement(prototype.is, opts);

        // 初始化stylesheet
        Nova.Style.init(prototype);

        return registerd;
    };

    var NovaExports = function NovaExports(prototype) {
        Nova.Base.mix(prototype, NovaExports.exports);
        var ret = Nova(prototype);
        NovaExports.exports = {};
        return ret;
    };
    NovaExports.exports = {};

    window.Nova = Nova;
    window.NovaExports = NovaExports;
})();
'use strict';

Nova.CssParse = (function () {

  var api = {
    // given a string of css, return a simple rule tree
    parse: function parse(text) {
      text = this._clean(text);
      return this._parseCss(this._lex(text), text);
    },

    // remove stuff we don't care about that may hinder parsing
    _clean: function _clean(cssText) {
      return cssText.replace(rx.comments, '').replace(rx.port, '');
    },

    // super simple {...} lexer that returns a node tree
    _lex: function _lex(text) {
      var root = { start: 0, end: text.length };
      var n = root;
      for (var i = 0, s = 0, l = text.length; i < l; i++) {
        switch (text[i]) {
          case this.OPEN_BRACE:
            //console.group(i);
            if (!n.rules) {
              n.rules = [];
            }
            var p = n;
            var previous = p.rules[p.rules.length - 1];
            n = { start: i + 1, parent: p, previous: previous };
            p.rules.push(n);
            break;
          case this.CLOSE_BRACE:
            //console.groupEnd(n.start);
            n.end = i + 1;
            n = n.parent || root;
            break;
        }
      }
      return root;
    },

    // add selectors/cssText to node tree
    _parseCss: function _parseCss(node, text) {
      var t = text.substring(node.start, node.end - 1);
      node.parsedCssText = node.cssText = t.trim();
      if (node.parent) {
        var ss = node.previous ? node.previous.end : node.parent.start;
        t = text.substring(ss, node.start - 1);
        // TODO(sorvell): ad hoc; make selector include only after last ;
        // helps with mixin syntax
        t = t.substring(t.lastIndexOf(';') + 1);
        var s = node.parsedSelector = node.selector = t.trim();
        node.atRule = s.indexOf(AT_START) === 0;
        // note, support a subset of rule types...
        if (node.atRule) {
          if (s.indexOf(MEDIA_START) === 0) {
            node.type = this.types.MEDIA_RULE;
          } else if (s.match(rx.keyframesRule)) {
            node.type = this.types.KEYFRAMES_RULE;
          }
        } else {
          if (s.indexOf(VAR_START) === 0) {
            node.type = this.types.MIXIN_RULE;
          } else {
            node.type = this.types.STYLE_RULE;
          }
        }
      }
      var r$ = node.rules;
      if (r$) {
        for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
          this._parseCss(r, text);
        }
      }
      return node;
    },

    // stringify parsed css.
    stringify: function stringify(node, preserveProperties, text) {
      text = text || '';
      // calc rule cssText
      var cssText = '';
      if (node.cssText || node.rules) {
        var r$ = node.rules;
        if (r$ && (preserveProperties || !hasMixinRules(r$))) {
          for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
            cssText = this.stringify(r, preserveProperties, cssText);
          }
        } else {
          cssText = preserveProperties ? node.cssText : removeCustomProps(node.cssText);
          cssText = cssText.trim();
          if (cssText) {
            cssText = '  ' + cssText + '\n';
          }
        }
      }
      // emit rule iff there is cssText
      if (cssText) {
        if (node.selector) {
          text += node.selector + ' ' + this.OPEN_BRACE + '\n';
        }
        text += cssText;
        if (node.selector) {
          text += this.CLOSE_BRACE + '\n\n';
        }
      }
      return text;
    },

    types: {
      STYLE_RULE: 1,
      KEYFRAMES_RULE: 7,
      MEDIA_RULE: 4,
      MIXIN_RULE: 1000
    },

    OPEN_BRACE: '{',
    CLOSE_BRACE: '}'

  };

  function hasMixinRules(rules) {
    return rules[0].selector.indexOf(VAR_START) >= 0;
  }

  function removeCustomProps(cssText) {
    return cssText.replace(rx.customProp, '').replace(rx.mixinProp, '').replace(rx.mixinApply, '').replace(rx.varApply, '');
  }

  var VAR_START = '--';
  var MEDIA_START = '@media';
  var AT_START = '@';

  // helper regexp's
  var rx = {
    comments: /\/\*[^*]*\*+([^/*][^*]*\*+)*\//gim,
    port: /@import[^;]*;/gim,
    customProp: /(?:^|[\s;])--[^;{]*?:[^{};]*?;/gim,
    mixinProp: /(?:^|[\s;])--[^;{]*?:[^{;]*?{[^}]*?};?/gim,
    mixinApply: /@apply[\s]*\([^)]*?\)[\s]*;/gim,
    varApply: /[^;:]*?:[^;]*var[^;]*;/gim,
    keyframesRule: /^@[^\s]*keyframes/
  };

  // exports
  return api;
})();
'use strict';
(function () {

  var CaseMap = {

    _caseMap: {},

    dashToCamelCase: function dashToCamelCase(dash) {
      var mapped = this._caseMap[dash];
      if (mapped) {
        return mapped;
      }
      // TODO(sjmiles): is rejection test actually helping perf?
      if (dash.indexOf('-') < 0) {
        return this._caseMap[dash] = dash;
      }
      return this._caseMap[dash] = dash.replace(/-([a-z])/g, function (m) {
        return m[1].toUpperCase();
      });
    },

    camelToDashCase: function camelToDashCase(camel) {
      var mapped = this._caseMap[camel];
      if (mapped) {
        return mapped;
      }
      return this._caseMap[camel] = camel.replace(/([a-z][A-Z])/g, function (g) {
        return g[0] + '-' + g[1].toLowerCase();
      });
    }

  };

  Nova.CaseMap = CaseMap;
})();
'use strict';
(function () {
    var lastInsertedStylesheet = undefined;

    var Style = {
        init: function init(prototype) {
            if (prototype.stylesheet) {
                var stylesheet = $(prototype.stylesheet);
                if (lastInsertedStylesheet) {
                    stylesheet.insertAfter(lastInsertedStylesheet);
                    lastInsertedStylesheet = stylesheet;
                } else {
                    (function () {
                        //let tagName = Nova.CaseMap.camelToDashCase(prototype.is);

                        var generateCss = function generateCss(rules) {
                            var generatedCss = '';
                            rules.forEach(function (rule) {
                                // style
                                if (rule.type == Nova.CssParse.types.STYLE_RULE) {
                                    // 生成selector
                                    var selectors = rule.selector.split(' ');
                                    var selector = '';
                                    selectors.forEach(function (s) {
                                        if (s == ':host') {
                                            selector += tagName + ' ';
                                        } else if (s == '::content') {} else {
                                            var pseudoStart = s.indexOf(':');
                                            if (pseudoStart < 0) {
                                                selector += s + '.' + tagName + ' ';
                                            } else {
                                                selector += s.slice(0, pseudoStart) + '.' + tagName + s.slice(pseudoStart) + ' ';
                                            }
                                        }
                                    });
                                    // 生成CSS属性
                                    var cssText = rule.cssText;
                                    generatedCss += selector + '\n{\n' + cssText + '\n}\n';
                                }

                                // keyframes
                                if (rule.type == Nova.CssParse.types.KEYFRAMES_RULE) {
                                    var selector = rule.selector;
                                    var cssText = rule.cssText;
                                    generatedCss += selector + '\n{\n' + cssText + '\n}\n';
                                }

                                // media rule
                                if (rule.type == Nova.CssParse.types.MEDIA_RULE) {
                                    var selector = rule.selector;
                                    var cssText = generateCss(rule.rules || []);
                                    generatedCss += selector + '\n{\n' + cssText + '\n}\n';
                                }
                            });
                            return generatedCss;
                        };

                        var style = Nova.CssParse.parse(stylesheet.html());
                        var tagName = prototype.is;
                        var styleText = generateCss(style.rules || []);
                        stylesheet.html(styleText);
                        stylesheet.prependTo($('head'));
                    })();
                }
            }
        }
    };

    Nova.Style = Style;
})();
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

//define(function() {
(function () {

    var EVENT_SPLITTER = ' ';

    var CustomEvent = (function () {
        function CustomEvent(target, type, eventArgs) {
            _classCallCheck(this, CustomEvent);

            Nova.Base.mix(this, [{
                target: target,
                type: type,
                timeStamp: new Date() - 1
            }, eventArgs], true);
        }

        _createClass(CustomEvent, [{
            key: 'preventDefault',
            value: function preventDefault() {
                this._defaultPrevented = true;
            }
        }]);

        return CustomEvent;
    })();

    var EventBehavior = {
        on: function on(events, callback, context) {
            var cache = undefined,
                event = undefined;

            if (!callback) return this;

            cache = this.__events = this.__events || {};
            events = events.split(EVENT_SPLITTER);
            while (event = events.shift()) {
                cache[event] = cache[event] || [];
                cache[event].push(callback, context);
            }
            return this;
        },

        // this.off() 清除全部
        // this.off('switch') 清除全部switch事件的处理函数
        // this.off('switch', 'fun1'); 清除switch事件的fun1处理函数
        off: function off(events, callback) {
            var cache = this.__events,
                event = undefined;

            // 全部为空，则清除全部handler
            if (!(events || callback)) {
                delete this.__events;
                return this;
            }
            events = events.split(EVENT_SPLITTER);
            while (event = events.shift()) {
                var handlers = cache[event];
                // 若callback为空，则去除所有event的handler
                if (!callback) {
                    delete cache[event];
                }
                // 否则遍历event的handler，去除指定callback
                else if (handlers) {
                    for (var i = 0, len = handlers.length; i < len - 1; i += 2) {
                        if (handlers[i] == callback) {
                            handlers.splice(i, 2);
                        }
                    }
                }
            }
            return this;
        },

        // this.trigger('switch', [args1, args2]);
        // this.trigger('switch change', [args1, args2]);
        // @return true/false
        trigger: function trigger(events) {
            var cache = this.__events,
                event = undefined,
                me = this,
                returnValue = true;

            if (!cache) return me;

            events = events.split(EVENT_SPLITTER);
            while (event = events.shift()) {
                var handlers = cache[event];
                var ev = new CustomEvent(me, event);
                if (handlers) {
                    for (var i = 0, len = handlers.length; i < len; i += 2) {
                        var ctx = handlers[i + 1] || me;
                        var args = arguments[1] ? arguments[1].slice() : [];
                        args.unshift(ev);

                        var ret = handlers[i].apply(ctx, args);

                        // 当callback返回false时，阻止事件继续触发
                        if (ret === false) {
                            ev.preventDefault();
                        }

                        if (ev._defaultPrevented) {
                            returnValue = false;
                            break;
                        }
                    }
                }
            }
            return returnValue;
        }
    };

    Nova.EventBehavior = EventBehavior;
})();
'use strict';
//define(['lib/case_map'], function(CaseMap) {
(function () {
    var PropBehavior = {
        props: function props() {},

        /*
        * Used when transfering attribute to prop
        */
        _propTypes: [Object, Number, String, Boolean, Date, Array],

        createdHandler: function createdHandler() {
            initProperties.call(this);
        },

        attributeChanged: function attributeChanged(attrName, oldVal, newVal) {
            var propName = Nova.CaseMap.dashToCamelCase(attrName);
            var prop = this.props[propName];
            if (prop) {
                setPropFromAttr.call(this, attrName, newVal);
            }
        }

    };

    /*
     * 初始化props
     * 1. 将props转换为标准格式{type:String, ...}
     * 2. 解析props的config，解析并应用到this
     * 3. 将attribute上的属性应用到props
     * */
    function initProperties() {
        var proto = {};
        var oldProto = this.__proto__;
        this.__proto__ = proto;
        proto.__proto__ = oldProto;
        for (var prop in this.props) {
            if (this.props.hasOwnProperty(prop)) {
                transferProperty.call(this, prop);
                defineProperty.call(this, prop, this.props[prop]);
            }
        }
    }

    function setPropFromAttr(attrName) {
        var propName = Nova.CaseMap.dashToCamelCase(attrName);
        var prop = this.props[propName];
        var val = this.getAttribute(attrName);
        this[propName] = fromAttrToProp.call(this, attrName, val, prop);
    }

    function transferProperty(prop) {
        var value = this.props[prop];
        // 检测是否简单写法，如果是，转换成完整写法
        if (this._propTypes.indexOf(value) >= 0) {
            this.props[prop] = {
                type: this.props[prop]
            };
        }
    }

    function defineProperty(name, config) {
        var self = this;
        var realPropPrefix = '_prop_';

        Object.defineProperty(this.__proto__, name, {

            get: function get() {
                return self[realPropPrefix + name];
            },
            set: function set(val) {
                //alert('set:' + name + ' to ' + val);
                var oldVal = self[realPropPrefix + name];

                if (val == oldVal) {
                    return;
                }

                self[realPropPrefix + name] = val;
                // TODO: 实现relectToAttribute
                /*
                if(config.reflectToAttribute) {
                    self.setAttribute(name, fromPropToAttr.call(this, config));
                }
                */
                self.trigger(getPropChangeEventName(name), [oldVal, val]);
            }
        });

        // init observers
        if (config.observer) {
            this.on(getPropChangeEventName(name), this[config.observer]);
        }

        // set value
        var attrName = Nova.CaseMap.camelToDashCase(name);
        if (this.hasAttribute(attrName)) {
            setPropFromAttr.call(this, attrName);
        } else if (config.hasOwnProperty('value')) {
            if (typeof config.value == 'function') {
                this[name] = config.value.apply(this);
            } else {
                this[name] = config.value;
            }
        }
    }

    function fromAttrToProp(attrName, value, config) {
        var type = config.type;
        if (type != String) {
            value = value.trim();
        }

        var result = value;
        switch (type) {
            case Object:
            case Array:
                result = JSON.parse(value);
                break;
            case Number:
                result = Number(value);
                break;
            case Date:
                result = new Date(value);
                break;
            case Boolean:
                return this.hasAttribute(attrName);
                break;
        }
        return result;
    }

    function getPropChangeEventName(propName) {
        return '_' + propName + 'Changed';
    }

    Nova.PropBehavior = PropBehavior;
})();

/*
prop: {
    type: 'String',
    value: 'haha',
    observe: '_xxx',
    reflectToAttribute: false
},
prop2: Object       // Object, Number, String, Boolean, Date, Array
*/
'use strict';
(function () {
    var TemplateBehavior = {
        BIND_TYPES: {
            INNERHTML: 1,
            ATTRIBUTE: 2
        },
        createdHandler: function createdHandler() {
            var _this = this;

            var self = this;
            if (this.template) {
                (function () {
                    var addClassToChildren = function addClassToChildren(parent, className) {
                        var children = parent.children();
                        children.each(function (index, ele) {
                            /***************************** 添加class实现css scope ******************************/
                            ele = $(ele);
                            ele.addClass(className);

                            /***************************** 替换模板中的占位符并监听 ******************************/

                            // 替换属性注解<div attr="{{annotation}}">
                            for (var i in ele[0].attributes) {
                                if (ele[0].attributes.hasOwnProperty(i) && ele[0].attributes[i].constructor == Attr) {
                                    var attr = ele[0].attributes[i];
                                    var _match = attr.value.match(/^{{(.+)}}$/);
                                    if (_match) {
                                        bind(ele, _match[1], self.BIND_TYPES.ATTRIBUTE, { name: attr.name });
                                    }
                                }
                            }

                            // 替换标签注解，<tagName>{{annotaion}}</tagName>
                            var html = ele.html().trim();
                            var match = html.match(/^{{(.+)}}$/);
                            if (match) {
                                bind(ele, match[1], self.BIND_TYPES.INNERHTML);
                            }

                            function bind(ele, prop, type, config) {
                                var propPath = prop.split('.');
                                if (self.props.hasOwnProperty(prop)) {
                                    self.on('_' + propPath[0] + 'Changed', function (ev, oldVal, newVal) {
                                        for (var i = 1; i < propPath.length; i++) {
                                            newVal = newVal[propPath[i]];
                                        }

                                        if (type == self.BIND_TYPES.INNERHTML) {
                                            ele.html(newVal);
                                        } else if (type == self.BIND_TYPES.ATTRIBUTE) {
                                            ele.attr(config.name, newVal);
                                        }
                                    });
                                }
                            }

                            if (ele.children().length > 0) {
                                addClassToChildren(ele, className);
                            }
                        });
                    };

                    var className = _this.is;
                    var template = $(_this.template).html();
                    var wrap = $('<div>');

                    //wrap.append(template);
                    wrap[0].innerHTML = template;

                    /***************************** content insertion ******************************/
                    self._contents = wrap.find('content');
                    self._contents.each(function (index, content) {
                        content = $(content);
                        var select = content.attr('select');
                        var replacement = undefined;
                        if (select) {
                            replacement = $(self).find(select);
                            replacement.insertBefore(content);
                        } else {
                            replacement = Array.prototype.slice.call(self.childNodes);
                            for (var i = 0; i < replacement.length; i++) {
                                content[0].parentNode.insertBefore(replacement[i], content[0]);
                            }
                        }
                        content.remove();
                    });

                    // 为所有节点加上class，实现CSS scrope
                    addClassToChildren(wrap, className);

                    /***************************** 生成DOM ******************************/
                    _this.innerHTML = '';
                    wrap.children().appendTo(_this);
                })();
            }
        }
    };

    Nova.TemplateBehavior = TemplateBehavior;
})();
'use strict';
//define(["props_behavior", "event_behavior", "template_behavior"], function(PropBehavior, EventBehavior, TemplateBehavior) {
(function () {

    var Base = {

        _behaviors: [Nova.EventBehavior, Nova.TemplateBehavior, Nova.PropBehavior],

        behaviors: [],

        props: {},

        /***************************** 生命周期 ******************************/
        createdCallback: function createdCallback() {
            this._initBehaviors();

            this.trigger('created');
            this.createdHandler && this.createdHandler();
        },

        attachedCallback: function attachedCallback() {
            this.trigger('attached');
            this.attachedHandler && this.attachedHandler();
        },

        detachedCallback: function detachedCallback() {
            this.trigger('detached');
            this.detachedHandler && this.detachedHandler();
        },

        attributeChangedCallback: function attributeChangedCallback(attrName, oldVal, newVal) {
            this.trigger('attributeChanged', [attrName, oldVal, newVal]);
            this.attributeChangedHandler && this.attributeChangedHandler(attrName, oldVal, newVal);
        },

        /***************************** 初始化behaviors ******************************/
        _initBehaviors: function _initBehaviors() {
            var self = this;
            var behaviors = self._behaviors.concat(self.behaviors);

            /* 将behaviors的行为和属性合并到元素上 */
            behaviors.forEach(function (behavior) {
                var toMix = self.mix({}, behavior);
                'createdHandler attachedHandler detachedHandler attributeChangedHandler'.split(' ').forEach(function (prop) {
                    delete toMix[prop];
                });

                // 合并方法
                self.mix(self, toMix);

                // 合并属性
                self.mix(self.props, toMix.props);
            });

            /* 在生命周期的各个阶段初始化behaviors */
            this.on('created attached detached attributeChanged', function (e) {
                behaviors.forEach(function (behavior) {
                    var handler = behavior[e.type + 'Handler'];
                    if (handler) {
                        handler.call(self, Array.prototype.slice.call(arguments, 1));
                    }
                });
            });
        },

        /***************************** helpers ******************************/
        mix: function mix(des, src, override) {
            if (src && src.constructor == Array) {
                for (var i = 0, len = src.length; i < len; i++) {
                    this.mix(des, src[i], override);
                }
                return des;
            }
            if (typeof override == 'function') {
                for (i in src) {
                    des[i] = override(des[i], src[i], i);
                }
            } else {
                for (i in src) {
                    //杩欓噷瑕佸姞涓€涓猟es[i]锛屾槸鍥犱负瑕佺収椤句竴浜涗笉鍙灇涓剧殑灞炴€�
                    if (override || !(des[i] || i in des)) {
                        des[i] = src[i];
                    }
                }
            }
            return des;
        },
        /*
        * 使object的原型链尾端指向inherited, 拥有inherited的属性和方法
        */
        chainObject: function chainObject(object, inherited) {
            if (object && inherited && object !== inherited) {
                if (!Object.__proto__) {
                    object = this.mix(Object.create(inherited), object, true);
                } else {
                    // 首先找到object原型链末端
                    var lastPrototype = object;
                    while (lastPrototype.__proto__ && lastPrototype.__proto__.__proto__) {
                        lastPrototype = lastPrototype.__proto__;
                    }
                    lastPrototype.__proto__ = inherited;
                }
            }
            return object;
        }

    };

    Base = Base.chainObject(Base, HTMLElement.prototype);

    Nova.Base = Base;
})();