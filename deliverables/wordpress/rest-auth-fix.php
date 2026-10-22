<?php
/**
 * Plugin Name: REST Auth Header Fix (masports)
 * Description: اجازه می‌دهد «رمز عبور برنامه» وردپرس روی این هاست کار کند: هدر حذف‌شدهٔ Authorization را از هدر جایگزین X-Authorization می‌خواند و درخواست‌های REST را برای رمز برنامه معتبر می‌شناسد، حتی اگر افزونه‌ای کاربر را زودتر تشخیص داده باشد. رمزها همچنان توسط خود وردپرس بررسی می‌شوند.
 * Version: 1.2
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

// ۳) نشانه‌های تشخیصی بی‌خطر در پاسخ‌های REST (بدون نام کاربری، رمز یا اطلاعات محرمانه).
add_filter( 'rest_post_dispatch', function ( $response ) use ( $mas_auth_seen ) {
	if ( ! ( $response instanceof WP_HTTP_Response ) ) {
		return $response;
	}
	$response->header( 'X-MAS-Auth-Fix', '1.2' );
	$response->header( 'X-MAS-Auth-Seen', $mas_auth_seen );
	$response->header( 'X-MAS-AppPw-Available', function_exists( 'wp_is_application_passwords_available' ) && wp_is_application_passwords_available() ? 'yes' : 'no' );
	$response->header( 'X-MAS-AppPw-InUse', class_exists( 'WP_Application_Passwords' ) && WP_Application_Passwords::is_in_use() ? 'yes' : 'no' );
	$response->header( 'X-MAS-PHP-Auth-User', empty( $_SERVER['PHP_AUTH_USER'] ) ? 'empty' : 'set' );
	// نتیجهٔ بررسی رمز برنامه توسط خود وردپرس (فقط کد نتیجه).
	$result = 'not-run';
	if ( ! empty( $_SERVER['PHP_AUTH_USER'] ) && function_exists( 'wp_authenticate_application_password' ) ) {
		$r = wp_authenticate_application_password( null, $_SERVER['PHP_AUTH_USER'], $_SERVER['PHP_AUTH_PW'] );
		$result = is_wp_error( $r ) ? $r->get_error_code() : ( $r instanceof WP_User ? 'ok' : 'null' );
	}
	$response->header( 'X-MAS-AppPw-Check', $result );
	// کدام افزونه‌ها در تشخیص کاربر دخالت دارند (فقط نام توابع).
	foreach ( array( 'determine_current_user', 'rest_authentication_errors', 'wp_is_application_passwords_available', 'wp_is_application_passwords_available_for_user' ) as $hook ) {
		$names = array();
		if ( isset( $GLOBALS['wp_filter'][ $hook ] ) ) {
			foreach ( $GLOBALS['wp_filter'][ $hook ]->callbacks as $prio => $cbs ) {
				foreach ( $cbs as $cb ) {
					$f = $cb['function'];
					if ( is_string( $f ) ) {
						$names[] = $prio . ':' . $f;
					} elseif ( is_array( $f ) ) {
						$names[] = $prio . ':' . ( is_object( $f[0] ) ? get_class( $f[0] ) : $f[0] ) . '::' . $f[1];
					} else {
						$names[] = $prio . ':closure';
					}
				}
			}
		}
		$response->header( 'X-MAS-Hook-' . str_replace( '_', '-', $hook ), substr( implode( ', ', $names ), 0, 400 ) ?: 'none' );
	}
	return $response;
} );
