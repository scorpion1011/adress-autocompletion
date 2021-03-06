jQuery(function () {
    var blockOverlayConfig = {
        message: null,
        overlayCSS: {
            background: '#fff',
            opacity: 0.6
        }
    };
    var mainForm = Object.create(jQuery('form.checkout.woocommerce-checkout').length ? MainFormCheckout : MainFormProfile);
    var billingCorrection = Object.create(AddressCorrection);
    var shippingCorrection = Object.create(AddressCorrection);
    var confirmationPopup = Object.create(ConfirmationPopup);

    billingCorrection.init('billing', addressAutocompletion.billing, blockOverlayConfig);
    shippingCorrection.init('shipping', addressAutocompletion.shipping, blockOverlayConfig);

    confirmationPopup.init(function () {
        billingCorrection.submit();
        shippingCorrection.submit();
        mainForm.submit();
    });

    confirmationPopup.addCorrection(billingCorrection);
    confirmationPopup.addCorrection(shippingCorrection);

    mainForm.onSubmit(function (event) {
        jQuery.blockUI(blockOverlayConfig);

        if (!confirmationPopup.needConfirmation()) {
            billingCorrection.submit();
            shippingCorrection.submit();
            jQuery.unblockUI();
            return true;
        }

        confirmationPopup.showConfirmPopup(function () {
            billingCorrection.submit();
            shippingCorrection.submit();
            mainForm.submit();
        });

        event.stopImmediatePropagation();
        return false;
    });
});

var AddressCorrection = {
    xhrAutoComplete:    null,
    xhrName:            null,
    timerId:            0,
    groupPrefix:        null,
    confirmationHeader: null,
    dataConfirmed:      null,
    blockOverlayConfig: null,
    flag:               0,
    gender:             'undefined',

    getGenderSelect: function () {
        var addressCorrection = this;
        return jQuery('#' + addressCorrection.groupPrefix + '_gender');
    },

    getNameInput: function () {
        var addressCorrection = this;
        return jQuery('#' + addressCorrection.groupPrefix + '_first_name');
    },

    getAddressInput: function () {
        var addressCorrection = this;
        return jQuery('#' + addressCorrection.groupPrefix + '_address_1');
    },

    getCityInput: function () {
        var addressCorrection = this;
        return jQuery('#' + addressCorrection.groupPrefix + '_city');
    },

    getZipInput: function () {
        var addressCorrection = this;
        return jQuery('#' + addressCorrection.groupPrefix + '_postcode');
    },

    getName: function () {
        var addressCorrection = this;
        return addressCorrection.getNameInput().val();
    },

    getAddress: function () {
        var addressCorrection = this;
        return addressCorrection.getAddressInput().val();
    },

    getCity: function () {
        var addressCorrection = this;
        return addressCorrection.getCityInput().val();
    },

    getZip: function () {
        var addressCorrection = this;
        return addressCorrection.getZipInput().val();
    },

    init: function (groupPrefix, confirmationHeader, blockOverlayConfig) {
        var addressCorrection = this;

        addressCorrection.groupPrefix        = groupPrefix;
        addressCorrection.confirmationHeader = confirmationHeader;
        addressCorrection.dataConfirmed      = 3;
        addressCorrection.blockOverlayConfig = blockOverlayConfig;

        addressCorrection.getCityInput().on('input', function () {
            addressCorrection.dataConfirmed = 0;
        });
        addressCorrection.getZipInput().on('input', function () {
            addressCorrection.dataConfirmed = 0;
        });
        addressCorrection.getAddressInput().on('input', function () {
            addressCorrection.dataConfirmed = 2;
        });
        addressCorrection.getNameInput().on('input', function () {
            try {
                addressCorrection.xhrName.abort();
            }
            catch (e) {
            }
            clearTimeout(addressCorrection.timerId);
            if(addressCorrection.getNameInput().val().length > 0) {
                addressCorrection.timerId = setTimeout(function () {
                    addressCorrection.xhrName = addressCorrection.request(addressCorrection.getNameInput(), {
                        action: 'action',
                        name: addressCorrection.getName(),
                        sender: 'name'
                    }, function (data) {
                        if (Array.isArray(data) && data.length > 0) {
                            addressCorrection.getNameInput().val(data[0]['name']);
                            addressCorrection.gender = data[0]['gender'];
                            addressCorrection.getGenderSelect().change();
                        }
                    });
                }, addressAutocompletion.delay);
            }
        });
        addressCorrection.getGenderSelect().change(function () {
            jQuery(this).removeClass('wrong-gender');
            if (
                'male'   == jQuery(this).val() && 'female' == addressCorrection.gender ||
                'female' == jQuery(this).val() && 'male'   == addressCorrection.gender
            ) {
                jQuery(this).addClass('wrong-gender');
            }
        });

        addressCorrection.getCityInput()   .autoComplete(addressCorrection.autoCompleteConfig('city'));
        addressCorrection.getZipInput()    .autoComplete(addressCorrection.autoCompleteConfig('zip'));
        addressCorrection.getAddressInput().autoComplete(addressCorrection.autoCompleteConfig('address'));
    },

    needRequest: function (data) {
        var addressCorrection = this;

        if (addressCorrection.isGermany()) {
            if ('city' == data.sender) {
                return data.city.length > 0;
            }
            if ('zip' == data.sender) {
                return data.zip.length > 0;
            }
            return data.address.length > 0;
        }
        return false;
    },

    getTargetInput: function (sender) {
        var addressCorrection = this;

        if ('city' == sender) {
            return addressCorrection.getCityInput();
        }
        else if ('zip' == sender) {
            return addressCorrection.getZipInput();
        }
        return addressCorrection.getAddressInput();
    },

    autoCompleteConfig: function (sender) {
        var addressCorrection = this;

        return {
            minChars:   0,
            cache:      false,
            delay:      addressAutocompletion.delay,
            source:     function (input, suggests) {
                try {
                    addressCorrection.xhrAutoComplete.abort();
                }
                catch (e) {
                }
                var data = {
                    action: 'action',
                    address: addressCorrection.getAddress(),
                    city: addressCorrection.getCity(),
                    zip: addressCorrection.getZip(),
                    sender: sender
                };
                if (addressCorrection.needRequest(data)) {
                    addressCorrection.xhrAutoComplete = addressCorrection.request(addressCorrection.getTargetInput(sender), data, function (data) {
                        suggests(data);
                    });
                }
                suggests([]);
            },
            renderItem: function (item, search) {
                search = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                var re = new RegExp('(' + search.split(' ').join('|') + ')', 'gi');
                var str = '';
                var attr = {};
                if ('address' == sender) {
                    str = item.street;
                    attr = {
                        'data-street': item.street,
                        'data-val': str
                    };
                }
                else {
                    str = item.postcode + ', ' + item.city;
                    attr = {
                        'data-city': item.city,
                        'data-postcode': item.postcode,
                        'data-val': str
                    };
                }
                var jqDiv = jQuery('<div><div class="autocomplete-suggestion"></div></div>');
                jQuery('div.autocomplete-suggestion', jqDiv)
                    .attr(attr)
                    .html(str.replace(re, '<b>$1</b>'));
                return jqDiv.html();
            },
            onSelect:   function (e, term, item) {
                if ('address' == sender) {
                    addressCorrection.getAddressInput().val(jQuery(item).attr('data-street'));
                    addressCorrection.disable();
                }
                else {
                    addressCorrection.getCityInput().val(jQuery(item).attr('data-city'));
                    addressCorrection.getZipInput() .val(jQuery(item).attr('data-postcode'));
                    addressCorrection.dataConfirmed = 2;
                }
                e.originalEvent.stopImmediatePropagation();
                e.originalEvent.preventDefault();
            }
        };
    },

    request: function (element, data, onSuccess) {
        var addressCorrection = this;

        var xhr = jQuery.get(addressAutocompletion.ajaxurl, data, function (response) {
            addressCorrection.log('Response is : ' + response);
            var arrayOfObjectProperty = [];
            var responseJson          = {};
            try {
                responseJson = jQuery.parseJSON(response);
            }
            catch (err) {
                addressCorrection.log('Can\'t parse the server response.');
            }
            jQuery.each(responseJson, function (key, value) {
                arrayOfObjectProperty.push(value);
                if('flag' in value && 1 == value['flag']) {
                    addressCorrection.flag = 1;
                }
            });
            onSuccess(arrayOfObjectProperty);
        })
        .fail(function () {
            addressCorrection.log('Request has been cancelled.');
        });
        addressCorrection.log('Request has been sent. ' + addressCorrection.compileUrl(data));

        return xhr;
    },

    isGermany: function () {
        var addressCorrection = this;

        return jQuery('#' + addressCorrection.groupPrefix + '_country').val().toLowerCase() == 'de';
    },

    log: function (message) {
        if (addressAutocompletion.isConsoleResponseNeeded) {
            console.log(message);
        }
    },

    compileUrl: function (data) {
        return addressAutocompletion.ajaxurl + '/' + jQuery.param(data);
    },

    needConfirmation: function () {
        var addressCorrection = this;
        //check if this kind of address presents and visible for user
        if (!jQuery('#' + addressCorrection.groupPrefix + '_country').length || !jQuery('#' + addressCorrection.groupPrefix + '_country').is(':visible')) {
            return false;
        }
        return addressCorrection.isGermany() && (addressCorrection.dataConfirmed != 3);
    },

    requestForSuggestions: function () {
        var addressCorrection = this;

        var data = {
            action: 'action',
            address: addressCorrection.getAddress(),
            city: addressCorrection.getCity(),
            zip: addressCorrection.getZip(),
            sender: 'submit'
        };

        addressCorrection.suggestions = [];
        xhr = jQuery.get(addressAutocompletion.ajaxurl, data, function (response) {
            addressCorrection.log('Response is : ' + response);

            var responseJson = {};
            try {
                responseJson = jQuery.parseJSON(response);
            }
            catch (err) {
                addressCorrection.log('Can\'t parse the server response.');
            }

            jQuery.each(responseJson, function (key, value) {
                if('flag' in value && 1 == value['flag']) {
                    addressCorrection.flag = 1;
                }
            });

            if (responseJson.length == 0 || responseJson.length == 1 && responseJson[0].city == data.city && responseJson[0].postcode == data.zip && responseJson[0].street == data.address) {
                addressCorrection.disable();
                return;
            }
            addressCorrection.suggestions = responseJson;
        });
        addressCorrection.log('Request has been sent. ' + addressCorrection.compileUrl(data));

        return xhr;
    },

    disable: function () {
        var addressCorrection = this;

        addressCorrection.dataConfirmed = 3;
    },

    getConfirmationPopupHtml: function (jqTemplate) {
        var addressCorrection = this;

        if (0 == addressCorrection.suggestions.length) {
            return '';
        }

        jQuery('.modal-title', jqTemplate).html(addressCorrection.confirmationHeader);

        jQuery.each(addressCorrection.suggestions, function (key, value) {
            jQuery('.enderecoCorrectedSuggestions', jqTemplate).append('<label><input type="radio" name="' + addressCorrection.groupPrefix + 'addressCorrection" data-id="' + (1 + key) + '">' + addressCorrection.escapeString(value.postcode + ' ' + value.city + ' ' + value.street) + '</label><br />');
            jQuery('.enderecoCorrectedSuggestions input', jqTemplate).last().attr({
                'data-city': value.city,
                'data-postcode': value.postcode,
                'data-address': value.street
            });
        });
        city = addressCorrection.getCity();
        postcode = addressCorrection.getZip();
        address = addressCorrection.getAddress();
        jQuery('.enderecoCurrentInput', jqTemplate).html('<label><input type="radio" name="' + addressCorrection.groupPrefix + 'addressCorrection" data-id="0" checked="checked">' + addressCorrection.escapeString(postcode + ' ' + city + ' ' + address) + '</label><br />');
        jQuery('.enderecoCurrentInput input', jqTemplate).last().attr({
            'data-city': city,
            'data-postcode': postcode,
            'data-address': address
        });

        return jqTemplate.html();
    },

    processFormData: function () {
        var addressCorrection = this;

        jQuery.each(jQuery('input[name=' + addressCorrection.groupPrefix + 'addressCorrection]'), function (index, node) {
            if (jQuery(node).attr('checked') == 'checked' && jQuery(node).attr('data-id') != 0) {
                addressCorrection.getCityInput()   .val(jQuery(node).attr('data-city'));
                addressCorrection.getZipInput()    .val(jQuery(node).attr('data-postcode'));
                addressCorrection.getAddressInput().val(jQuery(node).attr('data-address'));
            }
        });

        addressCorrection.disable();
    },

    escapeString: function (str) {
        return jQuery('<div>').text(str).html();
    },
    
    submit: function() {
        var addressCorrection = this;
        
        if(1 == addressCorrection.flag) {
            var data = { action: 'action', sender: 'flag' };
            jQuery.get(
                addressAutocompletion.ajaxurl,
                data,
                function (response) {
                    addressCorrection.log('Response is : ' + response);
                });
            addressCorrection.log('Request has been sent. ' + addressCorrection.compileUrl(data));
            addressCorrection.flag = 0;
        }
    }

};

var ConfirmationPopup = {

    corrections: [],

    jqTemplate: null,

    init: function (formSubmitCallback) {
        var confirmationPopup = this;

        ConfirmationPopup.jqTemplate = jQuery('#enderecoAddressCheckModal .panel-body').detach();

        jQuery('#enderecoAddressCheckSubmit').click(function () {
            for (var i in confirmationPopup.corrections) {
                confirmationPopup.corrections[i].processFormData();
            }
            jQuery('#enderecoAddressCheckModal').modal('hide');
            formSubmitCallback();
        });

    },

    addCorrection: function (correction) {
        var confirmationPopup = this;

        confirmationPopup.corrections.push(correction);
    },

    needConfirmation: function () {
        var confirmationPopup = this;

        for (var i in confirmationPopup.corrections) {
            if (confirmationPopup.corrections[i].needConfirmation()) {
                return true;
            }
        }
        return false;
    },

    showConfirmPopup: function (formSubmitCallback) {
        var confirmationPopup = this;

        var requests = [];
        for (var i in confirmationPopup.corrections) {
            if (confirmationPopup.corrections[i].needConfirmation()) {
                requests.push(confirmationPopup.corrections[i].requestForSuggestions());
            }
        }

        jQuery.when.apply(jQuery, requests).done(function () {
            jQuery.unblockUI();

            var html = '';

            for (var i in confirmationPopup.corrections) {
                if (confirmationPopup.corrections[i].needConfirmation()) {
                    html += confirmationPopup.corrections[i].getConfirmationPopupHtml(confirmationPopup.jqTemplate.clone());
                }
            }
            if (html) {
                jQuery('#enderecoAddressCheckModal .modal-body').html(html);
                jQuery('#enderecoAddressCheckModal').modal('show');
                return;
            }
            for (var i in confirmationPopup.corrections) {
                confirmationPopup.corrections[i].disable();
            }
            formSubmitCallback();
        });
    }

};

var MainFormCheckout = {

    submit: function () {
        jQuery('form.checkout.woocommerce-checkout').submit();
    },

    onSubmit: function (processCallback) {
        jQuery('form.checkout.woocommerce-checkout').on('checkout_place_order', function (event) {
            return processCallback(event);
        });
    }

}

var MainFormProfile = {

    submit: function () {
        jQuery('div.woocommerce-MyAccount-content form').submit();
    },

    onSubmit: function (processCallback) {
        jQuery('div.woocommerce-MyAccount-content button').on('click', function (event) {
            return processCallback(event);
        });
    }

}