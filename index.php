<?php
/**
 * Plugin Name: Adress Autocompletion
 * Description: Set up Endereco Address WebServices to the checkout page
 */

add_action( 'wp_enqueue_scripts', 'link_script' );
function link_script()
{
	wp_enqueue_script( 'custom-script', plugins_url() . '/adress_autocompletion/js/adress_correction.js', array('jquery') );

	wp_enqueue_style( 'autocomplete.css', plugins_url() . '/adress_autocompletion/js/jquery.auto-complete.css' );
	wp_enqueue_script( 'autocomplete', plugins_url() . '/adress_autocompletion/js/jquery.auto-complete.min.js' );

	wp_enqueue_style( 'bootstrap.min.css', 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css' );
	wp_enqueue_script( 'bootstrap.min.js', 'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js');

	wp_localize_script( 'custom-script', 'myPlugin',
		array(
			'ajaxurl' => admin_url('admin-ajax.php'),
			'isConsoleResponseNeeded' => true
		)
	);
}

add_action('wp_ajax_action', 'my_action_callback');
add_action('wp_ajax_nopriv_action', 'my_action_callback');
add_action('wp_footer', 'add_bootstrap_modale_template');

function add_bootstrap_modale_template()
{
	require_once __DIR__.'/modal.php';
}

function my_action_callback()
{
	require_once __DIR__.'/sdk/autoload.php';

	// 	$firstname = empty( $_GET['firstname'] ) ? '' : esc_attr( $_GET['firstname'] );

	$data = [];

	$sender  = empty( $_GET['sender'] ) ? '' : esc_attr( $_GET['sender'] );
	$zip     = empty( $_GET['zip'] ) ? '' : esc_attr( $_GET['zip'] );
	$city    = empty( $_GET['city'] ) ? '' : esc_attr( $_GET['city'] );
	$address = empty( $_GET['address'] ) ? '' : esc_attr( $_GET['address'] );

	switch($sender)
	{
		case 'city':
			if(!empty($city))
			{
				$cityExpansionRequest = new EnderecoCityExpansionRequest();
				$cityExpansionRequest->setCity($city);

				$data = getEndercoData($cityExpansionRequest);
			}
			break;
		case 'zip':
			if(!empty($zip))
			{
				$postCodeExpansionRequest = new EnderecoPostCodeExpansionRequest();
				$postCodeExpansionRequest->setPostcode($zip);

				$data = getEndercoData($postCodeExpansionRequest);
			}
			break;
		case 'address':
			if(!empty($zip) && !empty($city) && !empty($address))
			{
				$streetExpansionRequest = new EnderecoStreetExpansionRequest();
				$streetExpansionRequest->setPostcode($zip);
				$streetExpansionRequest->setCity($city);
				$streetExpansionRequest->setStreet($address);

				$data = getEndercoData($streetExpansionRequest);
			}
			break;
		case 'submit':
			$addressCheckRequest = new EnderecoAddressCheckRequest();
			$addressCheckRequest->setPostcode($zip);
			$addressCheckRequest->setCity($city);
			$addressCheckRequest->setStreet($address);

			$data = getEndercoData($addressCheckRequest);
			break;
	} 
	//$data = json_decode( '[{"postcode":"50127","city":"Bergheim","street":"\'<dds>\'\"fdsd"}]' );

	echo json_encode($data);

	wp_die();
}

/**
 * Request for Endereco data
 * @param EnderecoAbstractRequest $expansionRequest
 * @return Array
 */
function getEndercoData($expansionRequest)
{
	$data = [];

	$client = EnderecoClient::getInstance('mobilemojo', 'developer01', 'zG-BE$_9');

	foreach($client->executeRequest($expansionRequest)->getElements() as $expansion)
	{
		if($expansion instanceof OrwellInputAssistantPostCodeCityExpansionResultElement)
		{
			$postCode = $expansion->getPostCode();
			$city     = $expansion->getCity();
			if(!empty($postCode) || !empty($city))
			{
				$data[] = [
					'postcode' => $postCode,
					'city'     => $city,
				];
			}
		}
		else //OrwellInputAssistantStreetExpansionResultElement || EnderecoAddressCheckRequest
		{
			$postCode = $expansion->getPostCode();
			$city     = $expansion->getCity();
			$street = $expansion->getStreet();
			if(!empty($postCode) || !empty($city) || !empty($street))
			{
				$data[] = [
					'postcode' => $postCode,
					'city'     => $city,
					'street'   => $street
				];
			}
		}
	}

	return $data;
}

add_action('admin_menu', 'address_autocomlpete');

function address_autocomlpete() {
	add_menu_page('Autocomplete Plugin', 'Address autocomlpete', 'manage_options', 'address_autocomlpete', 'autocomplete_page', 'dashicons-carrot', 10);
}

function autocomplete_page() {
	require_once __DIR__.'/config.php';
}


add_filter( 'woocommerce_settings_tabs_array', 'add_settings_tab', 50 );
	
function add_settings_tab( $settings_tabs ) {
	$settings_tabs['settings_tab_demo'] = __( 'Settings Demo Tab', 'woocommerce-settings-tab-demo' );
	return $settings_tabs;
}

add_action( 'woocommerce_settings_tabs_settings_tab_demo', 'settings_tab' );
function settings_tab() {
    woocommerce_admin_fields( get_setting() );
}
function get_setting() {
    $settings = array(
        'section_title' => array(
            'name'     => __( 'Section Title', 'woocommerce-settings-tab-demo' ),
            'type'     => 'title',
            'desc'     => '',
            'id'       => 'wc_settings_tab_demo_section_title'
        ),
        'title' => array(
            'name' => __( 'Title', 'woocommerce-settings-tab-demo' ),
            'type' => 'text',
            'desc' => __( 'This is some helper text', 'woocommerce-settings-tab-demo' ),
            'id'   => 'wc_settings_tab_demo_title'
        ),
        'description' => array(
            'name' => __( 'Description', 'woocommerce-settings-tab-demo' ),
            'type' => 'textarea',
            'desc' => __( 'This is a paragraph describing the setting. Lorem ipsum yadda yadda yadda. Lorem ipsum yadda yadda yadda. Lorem ipsum yadda yadda yadda. Lorem ipsum yadda yadda yadda.', 'woocommerce-settings-tab-demo' ),
            'id'   => 'wc_settings_tab_demo_description'
        ),
        'section_end' => array(
             'type' => 'sectionend',
             'id' => 'wc_settings_tab_demo_section_end'
        )
    );
    return apply_filters( 'wc_settings_tab_demo_settings', $settings );
}

add_action( 'woocommerce_update_options_settings_tab_demo', 'update_settings' );
function update_settings() {
    woocommerce_update_options( get_settings() );
}