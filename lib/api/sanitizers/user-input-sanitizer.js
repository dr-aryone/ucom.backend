"use strict";
const errors_1 = require("../errors");
const sanitizeHtml = require('sanitize-html');
const unescape = require('unescape');
class UserInputSanitizer {
    static sanitizeInputWithModelProvider(body, fieldsSet) {
        for (const fieldName in fieldsSet) {
            if (!fieldsSet.hasOwnProperty(fieldName)) {
                continue;
            }
            if (!body[fieldName]) {
                continue;
            }
            const rules = fieldsSet[fieldName];
            if (!rules.request) {
                delete body[fieldName];
                continue;
            }
            const toSanitize = body[fieldName];
            let sanitized;
            switch (rules.request.sanitizationType) {
                case 'any':
                    sanitized = toSanitize;
                    break;
                case 'number':
                    sanitized = this.sanitizeNumberValue(toSanitize);
                    break;
                case 'text':
                    sanitized = this.sanitizeTextValue(toSanitize, true);
                    break;
                case 'html':
                    sanitized = this.sanitizeHtmlValue(toSanitize, true);
                    break;
                case 'boolean':
                    sanitized = this.sanitizeBooleanValue(toSanitize);
                    break;
                default:
                    throw new errors_1.AppError(`Unsupported sanitizationType: ${rules.request.sanitizationType}`);
            }
            body[fieldName] = sanitized;
        }
    }
    static sanitizeNumberValue(value) {
        return +value;
    }
    static sanitizeTextValue(value, toUnescape) {
        const sanitized = sanitizeHtml(value, {
            allowedTags: [],
            allowedAttributes: [],
        });
        return toUnescape ? unescape(sanitized) : sanitized;
    }
    static sanitizeHtmlValue(value, toUnescape) {
        const sanitized = sanitizeHtml(value, {
            allowedTags: Object.keys(this.getAllowedAttributes()),
            allowedAttributes: this.getAllowedAttributes(),
        });
        return toUnescape ? unescape(sanitized) : sanitized;
    }
    static sanitizeBooleanValue(value) {
        switch (typeof value) {
            case 'boolean':
                return value;
            case 'string':
                return value === 'false' ? false : !!value; // form-data might pass false as string
            case 'number':
            default:
                return !!value;
        }
    }
    /**
     *
     * @return {Object}
     * @private
     */
    static getAllowedAttributes() {
        const commonAllowedAttributes = [
            'class',
            'style',
            'src',
            'allowfullscreen',
            'allow',
            'href',
            'name',
            'target',
            'contenteditable',
            'data-poll',
        ];
        const tagsWithCommonAttributes = [
            'blockquote',
            'div',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'p',
            'b',
            'strong',
            'em',
            'br',
            'i',
            'section',
            'article',
            'dl',
            'dt',
            'dd',
            'a',
            'ul',
            'ol',
            'li',
            'b',
            'i',
            'u',
            'span',
            'strike',
            'figure',
            'a',
        ];
        const set = {};
        for (const tag of tagsWithCommonAttributes) {
            set[tag] = commonAllowedAttributes;
        }
        set.iframe = Array.prototype.concat(commonAllowedAttributes, [
            'scrolling',
        ]);
        set.img = Array.prototype.concat(commonAllowedAttributes, [
            'alt',
        ]);
        return set;
    }
}
module.exports = UserInputSanitizer;
