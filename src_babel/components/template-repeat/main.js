NovaExports.exports={"stylesheet":"\n        :host {display:none;}\n    ","template":"\n    "};
        'use strict';
        let TemplateRepeat = NovaExports({
            is: 'template-repeat',
            extends: 'template',
            props: {
                items: {
                    type: Array,
                    value: function() {
                        return []
                    }
                },
                as: {
                    type: Array,
                    value: 'item'
                },
                indexAs: {
                    type: String,
                    value: 'index'
                },
                parentSelector: String
            },
            createdHandler: function() {
                let self = this;

                this.insertParent = this.parentSelector ? this.parentElement.querySelector(this.parentSelector) :  this.parentElement;

                // NOTICE: 通过setTimeout，保证使用js通过wrap创建元素后，能获取内部的template-repeat
                setTimeout(function() {
                    self.parentElement && self.parentElement.removeChild(self);
                }, 0);

                this.on('_itemsChanged', this._itemsObserver);
                this.notifyPath('items');
            },
            _itemsObserver: function(ev, oldVal, newVal, path) {
                if(path != 'items' || !newVal) { return; }

                this.itemNodes = this.itemNodes || [];

                // 删除所有项
                for(let i = this.itemNodes.length - 1; i >= 0; i--) {
                    this.removeItem(i);
                }
                // 添加新项
                for(let i = 0, len = newVal.length; i < len; i++) {
                    this.appendItem(i);
                }
            },
            appendItem: function(index) {
                let self = this;
                let wrap = document.createElement('div');
                wrap.innerHTML = '<template-repeat-item index="' + index + '" item="{{items.' + index + '}}" as="' + this.as + '" index-as="' + this.indexAs + '">' + this.innerHTML + '</template-repeat-item>';
                let item = wrap.querySelector('template-repeat-item');

                console.log('append Item', {item: item, html: item.innerHTML});

                this.compileNode(wrap);
                item.insertParent = this.insertParent;
                item.readyToRender = true;

                item.on('_itemChanged', function(ev, oldVal, newVal, path) {
                    self.itemChangedHandler.call(self, ev, oldVal, newVal, path, index);
                });

                this.itemNodes.push(item);
            },
            removeItem: function(index) {
                let self = this;
                let item = this.itemNodes.splice(index, 1)[0];
                item._childNodes.forEach(function(node) {
                    node.parentElement && node.parentElement.removeChild(node);
                    self.unbindNode(item);
                });
            },
            itemChangedHandler: function(ev, oldVal, newVal, path, index) {
                this.trigger('itemChanged', oldVal, newVal, path, index);
            }
        });
    