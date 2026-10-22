<?php
/**
 * Plugin Name: REST Auth Header Fix (masports)
 * Description: اجازه می‌دهد «رمز عبور برنامه» وردپرس روی این هاست کار کند: هدر حذف‌شدهٔ Authorization را از هدر جایگزین X-Authorization می‌خواند و درخواست‌های REST را برای رمز برنامه معتبر می‌شناسد، حتی اگر افزونه‌ای کاربر را زودتر تشخیص داده باشد. رمزها همچنان توسط خود وردپرس بررسی می‌شوند.
 * Version: 1.1
 */

// ۱) هدر جایگزین را به جای هدر حذف‌شده بنشان.
$mas_auth_seen = 'none';
if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
	$mas_auth_seen = 'authorization';
} else {
	foreach ( array( 'HTTP_X_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION', 'REDIRECT_HTTP_X_AUTHORIZATION' ) as $key ) {
		if ( ! empty( $_SERVER[ $key ] ) ) {
			$_SERVER['HTTP_AUTHORIZATION'] = $_SERVER[ $key ];
			$mas_auth_seen = strtolower( $key );
			break;
		}
	}
}
if ( empty( $_SERVER['PHP_AUTH_USER'] ) && ! empty( $_SERVER['HTTP_AUTHORIZATION'] )
	&& 0 === stripos( $_SERVER['HTTP_AUTHORIZATION'], 'basic ' ) ) {
	$decoded = base64_decode( substr( $_SERVER['HTTP_AUTHORIZATION'], 6 ), true );
	if ( false !== $decoded && false !== strpos( $decoded, ':' ) ) {
		list( $_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW'] ) = explode( ':', $decoded, 2 );
	}
}

// ۲) درخواست‌های REST را از همان ابتدا «درخواست API» بدان تا رمز برنامه پذیرفته شود،
//    حتی اگر افزونه‌ای پیش از بارگذاری REST کاربر جاری را پرسیده باشد.
add_filter( 'application_password_is_api_request', function ( $is_api ) {
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '';
	if ( false !== strpos( $uri, '/wp-json/' ) || false !== strpos( $uri, 'rest_route=' ) ) {
		return true;
	}
	return $is_api;
} );

// ۳) نشانهٔ تشخیصی بی‌خطر در پاسخ‌های REST (بدون هیچ اطلاعات محرمانه).
add_filter( 'rest_post_dispatch', function ( $response ) use ( $mas_auth_seen ) {
	if ( $response instanceof WP_HTTP_Response ) {
		$response->header( 'X-MAS-Auth-Fix', '1.1' );
		$response->header( 'X-MAS-Auth-Seen', $mas_auth_seen );
	}
	return $response;
} );
