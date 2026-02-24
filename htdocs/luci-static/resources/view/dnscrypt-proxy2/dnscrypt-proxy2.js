'use strict';
'require fs';
'require form';
'require view';
'require poll';
'require rpc';
'require ui';

const CONFIG_FILE = '/etc/dnscrypt-proxy2/dnscrypt-proxy.toml';
const INIT_SCRIPT = '/etc/init.d/dnscrypt-proxy';

// Language from UCI - set during view load
var systemLang = null;

// Get current language - uses ONLY system language (cookie or UCI), no browser fallback
function getCurrentLang() {
	// First check if system language is available (set during load)
	if (systemLang === 'ru' || systemLang === 'en') {
		return systemLang;
	}
	
	var lang = 'en';
	
	// Check cookie (LuCI sets this when language changes)
	var cookies = document.cookie.split(';');
	for (var i = 0; i < cookies.length; i++) {
		var cookie = cookies[i].trim();
		if (cookie.startsWith('luci_language=')) {
			lang = cookie.split('=')[1];
			break;
		}
	}
	
	// Try LuCI's built-in function
	if (!lang || lang === 'en') {
		if (typeof L !== 'undefined' && L.getLanguage) {
			lang = L.getLanguage();
		}
	}
	
	// Check URL parameter
	if (!lang || lang === 'en') {
		var match = window.location.search.match(/lang=([^&]+)/);
		if (match && match[1]) {
			lang = match[1];
		}
	}
	
	// Normalize language code - ONLY allow en or ru, no browser fallback
	if (lang !== 'ru') {
		lang = 'en';
	}
	
	return lang;
}

function getSystemLanguage() {
	return new Promise(function(resolve) {
		// Try UCI RPC first
		var callUCI = rpc.declare({
			object: 'uci',
			method: 'get',
			params: ['config', 'section', 'option']
		});
		
		callUCI('luci', 'main', 'lang').then(function(val) {
			// Handle both string and object responses {value: "ru"}
			var langValue = null;
			if (typeof val === 'string') {
				langValue = val;
			} else if (val && typeof val === 'object' && val.value) {
				langValue = val.value;
			}
			
			// If language is "auto", use browser language
			if (langValue === 'auto') {
				if (navigator.language) {
					var browserLang = navigator.language.toLowerCase();
					if (browserLang.startsWith('ru')) {
						langValue = 'ru';
					} else {
						langValue = 'en';
					}
				} else {
					langValue = 'en';
				}
			}
			
			// Only support en and ru - fallback to English for other languages
			if (langValue === 'ru' || langValue === 'en') {
				systemLang = langValue;
			} else {
				// For any other language (de, fr, zh, etc.), fall back to English
				systemLang = 'en';
			}
			resolve(langValue);
		}).catch(function() {
			// If RPC fails, try to read the config file directly
			fs.read('/etc/config/luci').then(function(content) {
				if (content) {
					var match = content.match(/option lang '(\w+)'/);
					var langValue = match ? match[1] : null;
					
					// If language is "auto", use browser language
					if (langValue === 'auto') {
						if (navigator.language) {
							var browserLang = navigator.language.toLowerCase();
							if (browserLang.startsWith('ru')) {
								langValue = 'ru';
							} else {
								langValue = 'en';
							}
						} else {
							langValue = 'en';
						}
					}
					
					if (langValue === 'ru' || langValue === 'en') {
						systemLang = langValue;
						resolve(langValue);
					} else {
						resolve(null);
					}
				} else {
					resolve(null);
				}
			}).catch(function() {
				resolve(null);
			});
		});
	});
}

// Async function to get language including UCI
function getCurrentLangAsync() {
	var lang = getCurrentLang();
	
	// Try to get from UCI as well
	getLangFromUCI().then(function(uciLang) {
		if (uciLang && (uciLang === 'ru' || uciLang === 'en')) {
			cachedLang = uciLang;
		}
	});
	
	return lang;
}

// Translations - English base
var translations = {
	'DNSCrypt-Proxy 2': 'DNSCrypt-Proxy 2',
	'Status': 'Status',
	'RUNNING': 'RUNNING',
	'NOT RUNNING': 'NOT RUNNING',
	'Service Status': 'Service Status',
	'Start': 'Start',
	'Stop': 'Stop',
	'Restart': 'Restart',
	'Save & Apply': 'Save & Apply',
	'Service started': 'Service started',
	'Service stopped': 'Service stopped',
	'Configuration reloaded': 'Configuration reloaded',
	'Configuration saved. Restart service to apply changes.': 'Configuration saved. Restart service to apply changes.',
	'Configuration saved and service restarted': 'Configuration saved and service restarted',
	'Error': 'Error',
	'General': 'General',
	'Servers': 'Servers',
	'Connection': 'Connection',
	'Network': 'Network',
	'Load Balancing': 'Load Balancing',
	'Caching': 'Caching',
	'Filters': 'Filters',
	'Certificates': 'Certificates',
	'Logging': 'Logging',
	'Listen Addresses': 'Listen Addresses',
	'List of local addresses and ports to listen on': 'List of local addresses and ports to listen on',
	'Max Clients': 'Max Clients',
	'Maximum number of concurrent client connections': 'Maximum number of concurrent client connections',
	'User Name': 'User Name',
	'Change user after socket creation': 'Change user after socket creation',
	'Server Names': 'Server Names',
	'List of specific servers (leave empty for all available)': 'List of specific servers (leave empty for all available)',
	'Disabled Servers': 'Disabled Servers',
	'Servers to avoid': 'Servers to avoid',
	'IPv4 Servers': 'IPv4 Servers',
	'Use servers with IPv4 support': 'Use servers with IPv4 support',
	'IPv6 Servers': 'IPv6 Servers',
	'Use servers with IPv6 support': 'Use servers with IPv6 support',
	'DNSCrypt Servers': 'DNSCrypt Servers',
	'Use servers with DNSCrypt protocol': 'Use servers with DNSCrypt protocol',
	'DoH Servers': 'DoH Servers',
	'Use servers with DNS-over-HTTPS': 'Use servers with DNS-over-HTTPS',
	'ODoH Servers': 'ODoH Servers',
	'Use servers with Oblivious DoH': 'Use servers with Oblivious DoH',
	'Require DNSSEC': 'Require DNSSEC',
	'Server must support DNSSEC': 'Server must support DNSSEC',
	'No Logging': 'No Logging',
	'Server must not log queries': 'Server must not log queries',
	'No Filtering': 'No Filtering',
	'Server must not use blocklists': 'Server must not use blocklists',
	'Force TCP': 'Force TCP',
	'Always use TCP to connect to servers': 'Always use TCP to connect to servers',
	'Enable HTTP/3': 'Enable HTTP/3',
	'Enable experimental HTTP/3 support': 'Enable experimental HTTP/3 support',
	'HTTP/3 Probe': 'HTTP/3 Probe',
	'Always try HTTP/3 first for DoH servers': 'Always try HTTP/3 first for DoH servers',
	'Timeout (ms)': 'Timeout (ms)',
	'Timeout for DNS query response in milliseconds': 'Timeout for DNS query response in milliseconds',
	'Keepalive (s)': 'Keepalive (s)',
	'Connection keepalive time in seconds': 'Connection keepalive time in seconds',
	'SOCKS Proxy': 'SOCKS Proxy',
	'SOCKS proxy URL. Example: socks5://dnscrypt:dnscrypt@127.0.0.1:9050 (default: off)': 'SOCKS proxy URL. Example: socks5://dnscrypt:dnscrypt@127.0.0.1:9050 (default: off)',
	'HTTP/HTTPS Proxy': 'HTTP/HTTPS Proxy',
	'HTTP/HTTPS proxy for DoH servers. Example: http://127.0.0.1:8888 (default: off)': 'HTTP/HTTPS proxy for DoH servers. Example: http://127.0.0.1:8888 (default: off)',
	'Blocked Query Response': 'Blocked Query Response',
	'Response to blocked queries: refused, hinfo, nxdomain, a:IP (default: off)': 'Response to blocked queries: refused, hinfo, nxdomain, a:IP (default: off)',
	'Bootstrap Resolvers': 'Bootstrap Resolvers',
	'Plain DNS resolvers to obtain server list': 'Plain DNS resolvers to obtain server list',
	'Ignore System DNS': 'Ignore System DNS',
	'Ignore system DNS configuration': 'Ignore system DNS configuration',
	'Network Probe Timeout (s)': 'Network Probe Timeout (s)',
	'Maximum network connectivity check timeout': 'Maximum network connectivity check timeout',
	'Network Probe Address': 'Network Probe Address',
	'Address for network connectivity check': 'Address for network connectivity check',
	'Offline Mode': 'Offline Mode',
	'Do not use remote encrypted servers': 'Do not use remote encrypted servers',
	'Load Balancing Strategy': 'Load Balancing Strategy',
	'Load balancing strategy: wp2 (default), p2, p3, p4, p5, ph, first, random': 'Load balancing strategy: wp2 (default), p2, p3, p4, p5, ph, first, random',
	'Load Estimator': 'Load Estimator',
	'Continuously estimate latency and adjust balancing': 'Continuously estimate latency and adjust balancing',
	'Hot Reload': 'Hot Reload',
	'Enable hot reload of configuration files': 'Enable hot reload of configuration files',
	'Enable DNS Cache': 'Enable DNS Cache',
	'Enable DNS cache to reduce latency': 'Enable DNS cache to reduce latency',
	'Cache Size': 'Cache Size',
	'DNS cache size (number of entries)': 'DNS cache size (number of entries)',
	'Min TTL (s)': 'Min TTL (s)',
	'Minimum TTL for cached entries': 'Minimum TTL for cached entries',
	'Max TTL (s)': 'Max TTL (s)',
	'Maximum TTL for cached entries': 'Maximum TTL for cached entries',
	'Min Negative Cache TTL (s)': 'Min Negative Cache TTL (s)',
	'Minimum TTL for negative entries': 'Minimum TTL for negative entries',
	'Max Negative Cache TTL (s)': 'Max Negative Cache TTL (s)',
	'Maximum TTL for negative entries': 'Maximum TTL for negative entries',
	'Block IPv6': 'Block IPv6',
	'Immediately respond with empty answer to IPv6 queries': 'Immediately respond with empty answer to IPv6 queries',
	'Block Unqualified': 'Block Unqualified',
	'Respond to A/AAAA queries for names without domain': 'Respond to A/AAAA queries for names without domain',
	'Block Undelegated': 'Block Undelegated',
	'Respond to queries for local zones': 'Respond to queries for local zones',
	'Reject TTL (s)': 'Reject TTL (s)',
	'TTL for synthetic responses when blocking': 'TTL for synthetic responses when blocking',
	'Certificate Refresh (min)': 'Certificate Refresh (min)',
	'Certificate reload delay in minutes': 'Certificate reload delay in minutes',
	'Ignore Certificate Timestamp': 'Ignore Certificate Timestamp',
	'Do not verify certificate expiration on first connect': 'Do not verify certificate expiration on first connect',
	'DNSCrypt Ephemeral Keys': 'DNSCrypt Ephemeral Keys',
	'Create unique key for each query': 'Create unique key for each query',
	'Disable TLS Sessions': 'Disable TLS Sessions',
	'Disable TLS session tickets': 'Disable TLS session tickets',
	'Log Level': 'Log Level',
	'Log level: 0 (verbose) - 6 (errors only)': 'Log level: 0 (verbose) - 6 (errors only)',
	'Log File': 'Log File',
	'Path to log file': 'Path to log file',
	'Latest Log Only': 'Latest Log Only',
	'Keep logs only from last run': 'Keep logs only from last run',
	'Use Syslog': 'Use Syslog',
	'Use system logger': 'Use system logger',
	'Max Log Size (MB)': 'Max Log Size (MB)',
	'Maximum log file size': 'Maximum log file size',
	'Max Log Age (days)': 'Max Log Age (days)',
	'How many days to keep log backups': 'How many days to keep log backups',
	'Max Backups': 'Max Backups',
	'Maximum number of log backups': 'Maximum number of log backups',
	'Enable Logging': 'Enable Logging',
	'Enable or disable logging (uncomment/comment logging lines)': 'Enable or disable logging (uncomment/comment logging lines)',
	'Configuration': 'Configuration',
	'View configuration file': 'View configuration file',
	'Refresh': 'Refresh',
	'Loading...': 'Loading...',
	'CURRENT SERVER': 'CURRENT SERVER',
	'SERVERS NOT DETERMINED': 'SERVERS NOT DETERMINED',
	'ERROR GETTING SERVERS': 'ERROR GETTING SERVERS',
	'Redirect DNS': 'Redirect DNS',
	'Method 1:': 'Method 1:',
	'Method 2: SSH Terminal': 'Method 2: SSH Terminal',
	'Copy': 'Copy',
	'Copied!': 'Copied!',
	'Enter listen address': 'Enter listen address',
	'Log Viewer': 'Log Viewer',
	'File:': 'File:',
	'Press "Refresh" to load logs': 'Press "Refresh" to load logs',
	'Save': 'Save',
	'Select Server': 'Select Server',
	'Available Servers': 'Available Servers',
	'Search servers...': 'Search servers...',
	'Protocol': 'Protocol',
	'Address': 'Address',
	'DNSSEC': 'DNSSEC',
	'No Logging': 'No Logging',
	'No Filter': 'No Filter',
	'Description': 'Description',
	'Select': 'Select',
	'Close': 'Close',
	'Loading servers...': 'Loading servers...',
	'Error loading servers': 'Error loading servers',
	'Add to list': 'Add to list',
	'Clear': 'Clear',
	'Search by name or address': 'Search by name or address'
};

// Russian translations override
var translations_ru = {
	'DNSCrypt-Proxy 2': 'DNSCrypt-Прокси 2',
	'Status': 'Статус',
	'RUNNING': 'РАБОТАЕТ',
	'NOT RUNNING': 'НЕ РАБОТАЕТ',
	'Service Status': 'Статус сервиса',
	'Start': 'Запустить',
	'Stop': 'Остановить',
	'Restart': 'Перезагрузить',
	'Save & Apply': 'Сохранить и применить',
	'Service started': 'Сервис запущен',
	'Service stopped': 'Сервис остановлен',
	'Configuration reloaded': 'Конфигурация перезагружена',
	'Configuration saved. Restart service to apply changes.': 'Конфигурация сохранена. Перезапустите сервис для применения изменений.',
	'Configuration saved and service restarted': 'Конфигурация сохранена и сервис перезапущен',
	'Error': 'Ошибка',
	'General': 'Основные',
	'Servers': 'Серверы',
	'Connection': 'Подключение',
	'Network': 'Сеть',
	'Load Balancing': 'Балансировка',
	'Caching': 'Кэширование',
	'Filters': 'Фильтры',
	'Certificates': 'Сертификаты',
	'Logging': 'Логирование',
	'Listen Addresses': 'Адреса прослушивания',
	'List of local addresses and ports to listen on': 'Список локальных адресов и портов для прослушивания',
	'Max Clients': 'Макс. клиентов',
	'Maximum number of concurrent client connections': 'Максимальное количество одновременных подключений клиентов',
	'User Name': 'Имя пользователя',
	'Change user after socket creation': 'Сменить пользователя после создания сокетов',
	'Server Names': 'Имена серверов',
	'List of specific servers (leave empty for all available)': 'Список конкретных серверов (оставьте пустым для всех доступных)',
	'Disabled Servers': 'Отключённые серверы',
	'Servers to avoid': 'Серверы, которых следует избегать',
	'IPv4 Servers': 'IPv4 серверы',
	'Use servers with IPv4 support': 'Использовать серверы с поддержкой IPv4',
	'IPv6 Servers': 'IPv6 серверы',
	'Use servers with IPv6 support': 'Использовать серверы с поддержкой IPv6',
	'DNSCrypt Servers': 'DNSCrypt серверы',
	'Use servers with DNSCrypt protocol': 'Использовать серверы с протоколом DNSCrypt',
	'DoH Servers': 'DoH серверы',
	'Use servers with DNS-over-HTTPS': 'Использовать серверы с DNS-over-HTTPS',
	'ODoH Servers': 'ODoH серверы',
	'Use servers with Oblivious DoH': 'Использовать серверы с Oblivious DoH',
	'Require DNSSEC': 'Требовать DNSSEC',
	'Server must support DNSSEC': 'Сервер должен поддерживать DNSSEC',
	'No Logging': 'Без логирования',
	'Server must not log queries': 'Сервер не должен вести логи запросов',
	'No Filtering': 'Без фильтрации',
	'Server must not use blocklists': 'Сервер не должен использовать блоклист',
	'Force TCP': 'Принудительный TCP',
	'Always use TCP to connect to servers': 'Всегда использовать TCP для подключения к серверам',
	'Enable HTTP/3': 'Включить HTTP/3',
	'Enable experimental HTTP/3 support': 'Включить экспериментальную поддержку HTTP/3',
	'HTTP/3 Probe': 'Проба HTTP/3',
	'Always try HTTP/3 first for DoH servers': 'Всегда пробовать HTTP/3 первым для DoH серверов',
	'Timeout (ms)': 'Таймаут (мс)',
	'Timeout for DNS query response in milliseconds': 'Время ожидания ответа на DNS запрос в миллисекундах',
	'Keepalive (s)': 'Keepalive (с)',
	'Connection keepalive time in seconds': 'Время поддержания соединения в секундах',
	'SOCKS Proxy': 'SOCKS прокси',
	'SOCKS proxy URL. Example: socks5://dnscrypt:dnscrypt@127.0.0.1:9050 (default: off)': 'URL SOCKS прокси. Пример: socks5://dnscrypt:dnscrypt@127.0.0.1:9050 (по умолч.: выкл.)',
	'HTTP/HTTPS Proxy': 'HTTP/HTTPS прокси',
	'HTTP/HTTPS proxy for DoH servers. Example: http://127.0.0.1:8888 (default: off)': 'HTTP/HTTPS прокси для DoH серверов. Пример: http://127.0.0.1:8888 (по умолч.: выкл.)',
	'Blocked Query Response': 'Ответ на заблокированный запрос',
	'Response to blocked queries: refused, hinfo, nxdomain, a:IP (default: off)': 'Ответ на заблокированные запросы: refused, hinfo, nxdomain, a:IP (по умолч.: выкл.)',
	'Bootstrap Resolvers': 'Bootstrap резолверы',
	'Plain DNS resolvers to obtain server list': 'Обычные DNS резолверы для получения списка серверов',
	'Ignore System DNS': 'Игнорировать системный DNS',
	'Ignore system DNS configuration': 'Игнорировать системную конфигурацию DNS',
	'Network Probe Timeout (s)': 'Таймаут проверки сети (с)',
	'Maximum network connectivity check timeout': 'Максимальное время ожидания сетевого подключения',
	'Network Probe Address': 'Адрес проверки сети',
	'Address for network connectivity check': 'Адрес для проверки доступности сети',
	'Offline Mode': 'Офлайн режим',
	'Do not use remote encrypted servers': 'Не использовать удалённые зашифрованные серверы',
	'Load Balancing Strategy': 'Стратегия балансировки',
	'Load balancing strategy: wp2 (default), p2, p3, p4, p5, ph, first, random': 'Стратегия балансировки нагрузки: wp2 (по умолч.), p2, p3, p4, p5, ph, first, random',
	'Load Estimator': 'Оценщик нагрузки',
	'Continuously estimate latency and adjust balancing': 'Постоянно оценивать задержку и корректировать балансировку',
	'Hot Reload': 'Горячая перезагрузка',
	'Enable hot reload of configuration files': 'Включить горячую перезагрузку файлов конфигурации',
	'Enable DNS Cache': 'Включить DNS кэш',
	'Enable DNS cache to reduce latency': 'Включить DNS кэш для уменьшения задержки',
	'Cache Size': 'Размер кэша',
	'DNS cache size (number of entries)': 'Размер DNS кэша (количество записей)',
	'Min TTL (s)': 'Мин. TTL (с)',
	'Minimum TTL for cached entries': 'Минимальное TTL для кэшированных записей',
	'Max TTL (s)': 'Макс. TTL (с)',
	'Maximum TTL for cached entries': 'Максимальное TTL для кэшированных записей',
	'Min Negative Cache TTL (s)': 'Мин. TTL негативного кэша (с)',
	'Minimum TTL for negative entries': 'Минимальное TTL для негативных записей',
	'Max Negative Cache TTL (s)': 'Макс. TTL негативного кэша (с)',
	'Maximum TTL for negative entries': 'Максимальное TTL для негативных записей',
	'Block IPv6': 'Блокировать IPv6',
	'Immediately respond with empty answer to IPv6 queries': 'Немедленно отвечать пустым ответом на IPv6 запросы',
	'Block Unqualified': 'Блокировать бездоменные',
	'Respond to A/AAAA queries for names without domain': 'Отвечать на A/AAAA запросы для имён без домена',
	'Block Undelegated': 'Блокировать неделегированные',
	'Respond to queries for local zones': 'Отвечать на запросы для локальных зон',
	'Reject TTL (s)': 'TTL отклонения (с)',
	'TTL for synthetic responses when blocking': 'TTL для синтетических ответов при блокировке',
	'Certificate Refresh (min)': 'Обновление сертификатов (мин)',
	'Certificate reload delay in minutes': 'Задержка перезагрузки сертификатов в минутах',
	'Ignore Certificate Timestamp': 'Игнорировать время сертификата',
	'Do not verify certificate expiration on first connect': 'Не проверять срок действия сертификатов при первом подключении',
	'DNSCrypt Ephemeral Keys': 'Эфемерные ключи DNSCrypt',
	'Create unique key for each query': 'Создавать уникальный ключ для каждого запроса',
	'Disable TLS Sessions': 'Отключить TLS сессии',
	'Disable TLS session tickets': 'Отключить TLS сессионные билеты',
	'Log Level': 'Уровень логирования',
	'Log level: 0 (verbose) - 6 (errors only)': 'Уровень логирования: 0 (подробно) - 6 (только ошибки)',
	'Log File': 'Файл логов',
	'Path to log file': 'Путь к файлу логов',
	'Latest Log Only': 'Только последний лог',
	'Keep logs only from last run': 'Хранить логи только последнего запуска',
	'Use Syslog': 'Использовать syslog',
	'Use system logger': 'Использовать системный логгер',
	'Max Log Size (MB)': 'Макс. размер лога (МБ)',
	'Maximum log file size': 'Максимальный размер файла логов',
	'Max Log Age (days)': 'Макс. возраст лога (дни)',
	'How many days to keep log backups': 'Сколько дней хранить резервные копии логов',
	'Max Backups': 'Макс. резервных копий',
	'Maximum number of log backups': 'Максимальное количество резервных копий логов',
	'Enable Logging': 'Включить логирование',
	'Enable or disable logging (uncomment/comment logging lines)': 'Включить или выключить логирование (раскомментировать/закомментировать строки логирования)',
	'Configuration': 'Конфигурация',
	'View configuration file': 'Просмотр файла конфигурации',
	'Refresh': 'Обновить',
	'Loading...': 'Загрузка...',
	'CURRENT SERVER': 'ТЕКУЩИЙ СЕРВЕР',
	'SERVERS NOT DETERMINED': 'СЕРВЕРЫ НЕ ОПРЕДЕЛЕНЫ',
	'ERROR GETTING SERVERS': 'ОШИБКА ПОЛУЧЕНИЯ СЕРВЕРОВ',
	'Redirect DNS': 'Перенаправить DNS',
	'Method 1:': 'Способ 1:',
	'Method 2: SSH Terminal': 'Способ 2: SSH терминал',
	'Copy': 'Копировать',
	'Copied!': 'Скопировано!',
	'Enter listen address': 'Введите адрес прослушивания',
	'Log Viewer': 'Просмотр логов',
	'File:': 'Файл:',
	'Press "Refresh" to load logs': 'Нажмите "Обновить" для загрузки логов',
	'Save': 'Сохранить',
	'Select Server': 'Выбрать сервер',
	'Available Servers': 'Доступные серверы',
	'Search servers...': 'Поиск серверов...',
	'Protocol': 'Протокол',
	'Address': 'Адрес',
	'DNSSEC': 'DNSSEC',
	'No Logging': 'Без логирования',
	'No Filter': 'Без фильтра',
	'Description': 'Описание',
	'Select': 'Выбрать',
	'Close': 'Закрыть',
	'Loading servers...': 'Загрузка серверов...',
	'Error loading servers': 'Ошибка загрузки серверов',
	'Add to list': 'Добавить в список',
	'Clear': 'Очистить',
	'Search by name or address': 'Поиск по имени или адресу'
};

// Get translation
function i18n(key) {
	var lang = getCurrentLang();
	var trans = (lang === 'ru') ? translations_ru : translations;
	return trans[key] || translations[key] || key;
}

// Alias for shorter function name
function _(key) {
	return i18n(key);
}

// Custom notification helper
function showNotification(title, message, type) {
	var existingNotifications = document.querySelectorAll('.cbi-notify, .alert-message, .luci-message');
	if (existingNotifications.length > 0) {
		existingNotifications.forEach(function(notif) {
			if (notif.parentNode) {
				notif.parentNode.removeChild(notif);
			}
		});
	}
	ui.addNotification(null, E('p', message), type);
}

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('dnscrypt-proxy'), {})
		.then(function(res) {
			var is_running = false;
			try {
				var instances = res['dnscrypt-proxy']['instances'];
				for (var key in instances) {
					if (instances[key].running) {
						is_running = true;
						break;
					}
				}
			} catch (e) {}
			return is_running;
		});
}

function getCurrentServers() {
	var logPath = '/etc/dnscrypt-proxy2/dnscrypt-proxy.log';
	
	return fs.read(logPath).catch(function() { 
		return fs.read('/var/log/dnscrypt-proxy.log').catch(function() { return ''; });
	}).then(function(logContent) {
		var lines = logContent.split('\n');
		var servers = [];
		
		for (var i = lines.length - 1; i >= 0 && servers.length < 3; i--) {
			var line = lines[i];
			var match = line.match(/Server with the lowest initial latency:\s*(\S+).*\(rtt:\s*(\d+)ms\)/);
			if (match) {
				var serverName = match[1];
				var rtt = match[2];
				if (servers.indexOf(serverName + ' (' + rtt + 'ms)') === -1) {
					servers.push(serverName + ' (' + rtt + 'ms)');
				}
			}
			var match2 = line.match(/\[NOTICE\].*using\s+(\S+)/);
			if (match2) {
				var server = match2[1];
				if (servers.indexOf(server) === -1 && servers.length < 3) {
					servers.push(server);
				}
			}
		}
		
		return servers;
	});
}

function parseToml(content) {
	var result = {};
	var commentedValues = {};
	var lines = content.split('\n');
	var currentSection = '';
	
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var isCommented = /^\s*#/.test(line);
		var cleanLine = isCommented ? line.replace(/^\s*#\s*/, '') : line;
		cleanLine = cleanLine.trim();
		
		if (!cleanLine) continue;
		
		var sectionMatch = cleanLine.match(/^\[([^\]]+)\]$/);
		if (sectionMatch) {
			currentSection = sectionMatch[1];
			continue;
		}
		
		var match = cleanLine.match(/^(\w+)\s*=\s*(.*)$/);
		if (match) {
			var key = match[1];
			var value = match[2].trim();
			
			if (typeof value !== 'string') {
				value = String(value);
			}
			
			var isQuoted = (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
				(value.charAt(0) === "'" && value.charAt(value.length - 1) === "'");
			if (isQuoted) {
				value = value.slice(1, -1);
			}
			
			var n = parseFloat(value);
			if (typeof value === 'string' && !isNaN(n) && value.indexOf(':') < 0 && !/^\d+\.\d+/.test(value) && !/^http/i.test(value) && !/^socks/i.test(value)) {
				value = n;
			}
			
			if (typeof value === 'string' && value.charAt(0) === '[' && value.charAt(value.length - 1) === ']') {
				var arrContent = value.slice(1, -1).trim();
				if (arrContent) {
					var parsedValue = arrContent.split(',').map(function(v) {
						v = v.trim();
						if ((v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') || 
							(v.charAt(0) === "'" && v.charAt(v.length - 1) === "'")) {
							return v.slice(1, -1);
						}
						var n = parseFloat(v);
						return isNaN(n) ? v : n;
					});
					if (isCommented) {
						commentedValues[currentSection ? currentSection + '.' + key : key] = parsedValue;
					} else {
						result[currentSection ? currentSection + '.' + key : key] = parsedValue;
					}
				} else {
					if (isCommented) {
						commentedValues[currentSection ? currentSection + '.' + key : key] = [];
					} else {
						result[currentSection ? currentSection + '.' + key : key] = [];
					}
				}
			} else {
				var parsedValue;
				if (value === 'true') {
					parsedValue = true;
				} else if (value === 'false') {
					parsedValue = false;
				} else if (value === 'null' || value === '') {
					parsedValue = null;
				} else {
					var n = parseFloat(value);
					if (typeof value !== 'string' || isNaN(n) || value.indexOf(':') >= 0 || /^\d+\.\d+/.test(value)) {
						parsedValue = value;
					} else {
						parsedValue = n;
					}
				}
				
				if (isCommented) {
					commentedValues[currentSection ? currentSection + '.' + key : key] = parsedValue;
				} else {
					result[currentSection ? currentSection + '.' + key : key] = parsedValue;
				}
			}
		}
	}
	
	result._commented = commentedValues;
	return result;
}

function escapeHtml(text) {
	if (!text) return '';
	return text
		.replace(/&/g, '&')
		.replace(/</g, '<')
		.replace(/>/g, '>')
		.replace(/"/g, '"')
		.replace(/'/g, '&#039;');
}

// Field descriptions - English
var fieldDescriptions = {
	'listen_addresses': 'List of local addresses and ports to listen on',
	'max_clients': 'Maximum number of concurrent client connections',
	'user_name': 'Change user after socket creation',
	'server_names': 'List of specific servers (leave empty for all available)',
	'disabled_server_names': 'Servers to avoid',
	'ipv4_servers': 'Use servers with IPv4 support',
	'ipv6_servers': 'Use servers with IPv6 support',
	'dnscrypt_servers': 'Use servers with DNSCrypt protocol',
	'doh_servers': 'Use servers with DNS-over-HTTPS',
	'odoh_servers': 'Use servers with Oblivious DoH',
	'require_dnssec': 'Server must support DNSSEC',
	'require_nolog': 'Server must not log queries',
	'require_nofilter': 'Server must not use blocklists',
	'force_tcp': 'Always use TCP to connect to servers',
	'http3': 'Enable experimental HTTP/3 support',
	'http3_probe': 'Always try HTTP/3 first for DoH servers',
	'timeout': 'Timeout for DNS query response in milliseconds',
	'keepalive': 'Connection keepalive time in seconds',
	'proxy': 'SOCKS proxy URL. Example: socks5://dnscrypt:dnscrypt@127.0.0.1:9050 (default: off)',
	'http_proxy': 'HTTP/HTTPS proxy for DoH servers. Example: http://127.0.0.1:8888 (default: off)',
	'blocked_query_response': 'Response to blocked queries: refused, hinfo, nxdomain, a:IP (default: off)',
	'bootstrap_resolvers': 'Plain DNS resolvers to obtain server list',
	'ignore_system_dns': 'Ignore system DNS configuration',
	'netprobe_timeout': 'Maximum network connectivity check timeout',
	'netprobe_address': 'Address for network connectivity check',
	'offline_mode': 'Do not use remote encrypted servers',
	'lb_strategy': 'Load balancing strategy: wp2 (default), p2, p3, p4, p5, ph, first, random',
	'lb_estimator': 'Continuously estimate latency and adjust balancing',
	'enable_hot_reload': 'Enable hot reload of configuration files',
	'cache': 'Enable DNS cache to reduce latency',
	'cache_size': 'DNS cache size (number of entries)',
	'cache_min_ttl': 'Minimum TTL for cached entries',
	'cache_max_ttl': 'Maximum TTL for cached entries',
	'cache_neg_min_ttl': 'Minimum TTL for negative entries',
	'cache_neg_max_ttl': 'Maximum TTL for negative entries',
	'block_ipv6': 'Immediately respond with empty answer to IPv6 queries',
	'block_unqualified': 'Respond to A/AAAA queries for names without domain',
	'block_undelegated': 'Respond to queries for local zones',
	'reject_ttl': 'TTL for synthetic responses when blocking',
	'cert_refresh_delay': 'Certificate reload delay in minutes',
	'cert_ignore_timestamp': 'Do not verify certificate expiration on first connect',
	'dnscrypt_ephemeral_keys': 'Create unique key for each query',
	'tls_disable_session_tickets': 'Disable TLS session tickets',
	'log_level': 'Log level: 0 (verbose) - 6 (errors only)',
	'log_file': 'Path to log file',
	'log_file_latest': 'Keep logs only from last run',
	'use_syslog': 'Use system logger',
	'log_files_max_size': 'Maximum log file size',
	'log_files_max_age': 'How many days to keep log backups',
	'log_files_max_backups': 'Maximum number of log backups'
};

// Field descriptions - Russian
var fieldDescriptions_ru = {
	'listen_addresses': 'Список локальных адресов и портов для прослушивания',
	'max_clients': 'Максимальное количество одновременных подключений клиентов',
	'user_name': 'Сменить пользователя после создания сокетов',
	'server_names': 'Список конкретных серверов (оставьте пустым для всех доступных)',
	'disabled_server_names': 'Серверы, которых следует избегать',
	'ipv4_servers': 'Использовать серверы с поддержкой IPv4',
	'ipv6_servers': 'Использовать серверы с поддержкой IPv6',
	'dnscrypt_servers': 'Использовать серверы с протоколом DNSCrypt',
	'doh_servers': 'Использовать серверы с DNS-over-HTTPS',
	'odoh_servers': 'Использовать серверы с Oblivious DoH',
	'require_dnssec': 'Сервер должен поддерживать DNSSEC',
	'require_nolog': 'Сервер не должен вести логи запросов',
	'require_nofilter': 'Сервер не должен использовать блоклист',
	'force_tcp': 'Всегда использовать TCP для подключения к серверам',
	'http3': 'Включить экспериментальную поддержку HTTP/3',
	'http3_probe': 'Всегда пробовать HTTP/3 первым для DoH серверов',
	'timeout': 'Время ожидания ответа на DNS запрос в миллисекундах',
	'keepalive': 'Время поддержания соединения в секундах',
	'proxy': 'URL SOCKS прокси. Пример: socks5://dnscrypt:dnscrypt@127.0.0.1:9050 (по умолч.: выкл.)',
	'http_proxy': 'HTTP/HTTPS прокси для DoH серверов. Пример: http://127.0.0.1:8888 (по умолч.: выкл.)',
	'blocked_query_response': 'Ответ на заблокированные запросы: refused, hinfo, nxdomain, a:IP (по умолч.: выкл.)',
	'bootstrap_resolvers': 'Обычные DNS резолверы для получения списка серверов',
	'ignore_system_dns': 'Игнорировать системную конфигурацию DNS',
	'netprobe_timeout': 'Максимальное время ожидания сетевого подключения',
	'netprobe_address': 'Адрес для проверки доступности сети',
	'offline_mode': 'Не использовать удалённые зашифрованные серверы',
	'lb_strategy': 'Стратегия балансировки нагрузки: wp2 (по умолч.), p2, p3, p4, p5, ph, first, random',
	'lb_estimator': 'Постоянно оценивать задержку и корректировать балансировку',
	'enable_hot_reload': 'Включить горячую перезагрузку файлов конфигурации',
	'cache': 'Включить DNS кэш для уменьшения задержки',
	'cache_size': 'Размер DNS кэша (количество записей)',
	'cache_min_ttl': 'Минимальное TTL для кэшированных записей',
	'cache_max_ttl': 'Максимальное TTL для кэшированных записей',
	'cache_neg_min_ttl': 'Минимальное TTL для негативных записей',
	'cache_neg_max_ttl': 'Максимальное TTL для негативных записей',
	'block_ipv6': 'Немедленно отвечать пустым ответом на IPv6 запросы',
	'block_unqualified': 'Отвечать на A/AAAA запросы для имён без домена',
	'block_undelegated': 'Отвечать на запросы для локальных зон',
	'reject_ttl': 'TTL для синтетических ответов при блокировке',
	'cert_refresh_delay': 'Задержка перезагрузки сертификатов в минутах',
	'cert_ignore_timestamp': 'Не проверять срок действия сертификатов при первом подключении',
	'dnscrypt_ephemeral_keys': 'Создавать уникальный ключ для каждого запроса',
	'tls_disable_session_tickets': 'Отключить TLS сессионные билеты',
	'log_level': 'Уровень логирования: 0 (подробно) - 6 (только ошибки)',
	'log_file': 'Путь к файлу логов',
	'log_file_latest': 'Хранить логи только последнего запуска',
	'use_syslog': 'Использовать системный логгер',
	'log_files_max_size': 'Максимальный размер файла логов',
	'log_files_max_age': 'Сколько дней хранить резервные копии логов',
	'log_files_max_backups': 'Максимальное количество резервных копий логов'
};

// Get localized field description
function getFieldDescription(key) {
	var lang = getCurrentLang();
	var trans = (lang === 'ru') ? fieldDescriptions_ru : fieldDescriptions;
	return trans[key] || fieldDescriptions[key] || '';
}

function renderCheckbox(name, value, label, description) {
	var isChecked = (value === true);
	var descHtml = description ? E('div', { style: 'font-size:12px;color:#666;margin-top:2px' }, description) : '';
	return E('div', { class: 'cbi-value' }, [
		E('label', { class: 'cbi-value-title' }, label),
		E('div', { class: 'cbi-value-field' }, [
			E('input', { type: 'checkbox', name: name, checked: isChecked ? 'checked' : null }),
			descHtml
		])
	]);
}

function renderTextField(name, value, label, description, commentedValue, button) {
	var descHtml = description ? E('div', { style: 'font-size:12px;color:#666;margin-top:2px' }, description) : '';
	var strValue = (value !== undefined && value !== null) ? String(value) : '';
	var displayValue = strValue;
	var inputStyle = 'width:300px';
	
	if (button) {
		return E('div', { class: 'cbi-value' }, [
			E('label', { class: 'cbi-value-title' }, label),
			E('div', { class: 'cbi-value-field' }, [
				E('div', { style: 'display:flex;align-items:center' }, [
					E('input', { type: 'text', name: name, value: displayValue, style: inputStyle }),
					button
				]),
				descHtml
			])
		]);
	}
	
	return E('div', { class: 'cbi-value' }, [
		E('label', { class: 'cbi-value-title' }, label),
		E('div', { class: 'cbi-value-field' }, [
			E('input', { type: 'text', name: name, value: displayValue, style: inputStyle }),
			descHtml
		])
	]);
}

function renderNumberField(name, value, label, description) {
	var descHtml = description ? E('div', { style: 'font-size:12px;color:#666;margin-top:2px' }, description) : '';
	var displayValue = (value !== undefined && value !== null) ? String(value) : '0';
	return E('div', { class: 'cbi-value' }, [
		E('label', { class: 'cbi-value-title' }, label),
		E('div', { class: 'cbi-value-field' }, [
			E('input', { type: 'number', name: name, value: displayValue, style: 'width:100px' }),
			descHtml
		])
	]);
}

function renderSelect(name, value, label, options, description) {
	var opts = [];
	var displayValue = (value !== undefined && value !== null) ? String(value) : '';
	for (var i = 0; i < options.length; i++) {
		var opt = options[i];
		var isSelected = (String(opt[0]) === displayValue);
		opts.push(E('option', { value: opt[0], selected: isSelected ? 'selected' : null }, opt[1]));
	}
	var descHtml = description ? E('div', { style: 'font-size:12px;color:#666;margin-top:2px' }, description) : '';
	return E('div', { class: 'cbi-value' }, [
		E('label', { class: 'cbi-value-title' }, label),
		E('div', { class: 'cbi-value-field' }, [
			E('select', { name: name }, opts),
			descHtml
		])
	]);
}

return view.extend({
	load: function() {
		var self = this;
		
		// Get system language from UCI and use it directly
		return getSystemLanguage().then(function(lang) {
			// Debug: log the language
			console.log('System language from UCI:', lang, 'systemLang:', systemLang);
			
			// Just read config and get service status - language is read in getCurrentLang()
			return fs.read(CONFIG_FILE).catch(function() { return ''; }).then(function(content) {
				self.configContent = content;
				return getServiceStatus();
			});
		});
	},

	handleSave: function() {
		return this.saveConfig().then(function() {
			showNotification(null, i18n('Configuration saved. Restart service to apply changes.'), 'info');
		});
	},
	
	handleSaveApply: function() {
		var self = this;
		return this.saveConfig().then(function() {
			return fs.exec(INIT_SCRIPT, ['restart']);
		}).then(function() {
			showNotification(null, i18n('Configuration saved and service restarted'), 'info');
		}).catch(function(e) {
			showNotification(null, i18n('Error') + ': ' + (e.message || JSON.stringify(e)), 'error');
		});
	},
	
	handleReset: function() {
		window.location.reload();
	},
	
	saveConfig: function() {
		var self = this;
		
		function getValue(name) {
			var el = document.querySelector('#dnscrypt-proxy-form [name="' + name + '"]');
			return el ? el.value : '';
		}
		
		function getCheckbox(name) {
			var el = document.querySelector('#dnscrypt-proxy-form [name="' + name + '"]');
			return el ? el.checked : false;
		}
		
		return fs.read(CONFIG_FILE).then(function(originalContent) {
			var lines = originalContent.split('\n');
			var updates = {};
			var enableLogging = getCheckbox('enable_logging');
			
			updates['listen_addresses'] = getValue('listen_addresses').split(',').map(function(s) { return s.trim(); });
			updates['max_clients'] = parseInt(getValue('max_clients')) || 250;
			updates['user_name'] = getValue('user_name').trim() || null;
			updates['server_names'] = getValue('server_names').trim() ? getValue('server_names').split(',').map(function(s) { return s.trim(); }) : [];
			updates['disabled_server_names'] = getValue('disabled_server_names').trim() ? getValue('disabled_server_names').split(',').map(function(s) { return s.trim(); }) : [];
			updates['ipv4_servers'] = getCheckbox('ipv4_servers');
			updates['ipv6_servers'] = getCheckbox('ipv6_servers');
			updates['dnscrypt_servers'] = getCheckbox('dnscrypt_servers');
			updates['doh_servers'] = getCheckbox('doh_servers');
			updates['odoh_servers'] = getCheckbox('odoh_servers');
			updates['require_dnssec'] = getCheckbox('require_dnssec');
			updates['require_nolog'] = getCheckbox('require_nolog');
			updates['require_nofilter'] = getCheckbox('require_nofilter');
			updates['force_tcp'] = getCheckbox('force_tcp');
			updates['http3'] = getCheckbox('http3');
			updates['http3_probe'] = getCheckbox('http3_probe');
			updates['timeout'] = parseInt(getValue('timeout')) || 5000;
			updates['keepalive'] = parseInt(getValue('keepalive')) || 30;
			updates['proxy'] = getValue('proxy').trim() || null;
			updates['http_proxy'] = getValue('http_proxy').trim() || null;
			updates['blocked_query_response'] = getValue('blocked_query_response').trim() || null;
			updates['bootstrap_resolvers'] = getValue('bootstrap_resolvers').split(',').map(function(s) { return s.trim(); });
			updates['ignore_system_dns'] = getCheckbox('ignore_system_dns');
			updates['netprobe_timeout'] = parseInt(getValue('netprobe_timeout')) || 60;
			updates['netprobe_address'] = getValue('netprobe_address').trim() || '9.9.9.9:53';
			updates['offline_mode'] = getCheckbox('offline_mode');
			updates['lb_strategy'] = getValue('lb_strategy').trim() || 'wp2';
			updates['lb_estimator'] = getCheckbox('lb_estimator');
			updates['enable_hot_reload'] = getCheckbox('enable_hot_reload');
			updates['cache'] = getCheckbox('cache');
			updates['cache_size'] = parseInt(getValue('cache_size')) || 4096;
			updates['cache_min_ttl'] = parseInt(getValue('cache_min_ttl')) || 2400;
			updates['cache_max_ttl'] = parseInt(getValue('cache_max_ttl')) || 86400;
			updates['cache_neg_min_ttl'] = parseInt(getValue('cache_neg_min_ttl')) || 60;
			updates['cache_neg_max_ttl'] = parseInt(getValue('cache_neg_max_ttl')) || 600;
			updates['block_ipv6'] = getCheckbox('block_ipv6');
			updates['block_unqualified'] = getCheckbox('block_unqualified');
			updates['block_undelegated'] = getCheckbox('block_undelegated');
			updates['reject_ttl'] = parseInt(getValue('reject_ttl')) || 10;
			updates['cert_refresh_delay'] = parseInt(getValue('cert_refresh_delay')) || 240;
			updates['cert_ignore_timestamp'] = getCheckbox('cert_ignore_timestamp');
			updates['dnscrypt_ephemeral_keys'] = getCheckbox('dnscrypt_ephemeral_keys');
			updates['tls_disable_session_tickets'] = getCheckbox('tls_disable_session_tickets');
			updates['log_level'] = parseInt(getValue('log_level')) || 2;
			var logFile = getValue('log_file').trim();
			if (!logFile && enableLogging) logFile = 'dnscrypt-proxy.log';
			updates['log_file'] = logFile || null;
			updates['log_file_latest'] = getCheckbox('log_file_latest');
			updates['use_syslog'] = getCheckbox('use_syslog');
			updates['log_files_max_size'] = parseInt(getValue('log_files_max_size')) || 10;
			updates['log_files_max_age'] = parseInt(getValue('log_files_max_age')) || 7;
			updates['log_files_max_backups'] = parseInt(getValue('log_files_max_backups')) || 1;
			
			var loggingKeys = ['log_level', 'log_file', 'log_file_latest', 'use_syslog', 'log_files_max_size', 'log_files_max_age', 'log_files_max_backups'];
			var uncommentKeys = ['proxy', 'http_proxy', 'blocked_query_response', 'lb_strategy', 'user_name', 'server_names', 'disabled_server_names', 'netprobe_address', 'log_file'];
			var booleanKeys = ['cert_ignore_timestamp', 'dnscrypt_ephemeral_keys', 'tls_disable_session_tickets', 'lb_estimator', 'enable_hot_reload', 'log_file_latest'];
			
			var currentSection = '';
			var inCommentBlock = false;
			var modifiedLines = lines.map(function(line) {
				var trimmed = line.trim();
				if (trimmed.startsWith('###')) { inCommentBlock = true; return line; }
				if (trimmed.startsWith('##') && trimmed.length > 2) { inCommentBlock = false; return line; }
				
				if (loggingKeys.indexOf(trimmed.replace(/^#\s*/, '').split('=')[0].trim()) !== -1) {
					var keyMatch = trimmed.match(/^#?\s*(\w+)\s*=/);
					if (keyMatch && loggingKeys.indexOf(keyMatch[1]) !== -1) {
						var indent = line.match(/^(\s*)/)[1];
						var key = keyMatch[1];
						var value = updates[key];
						if (value === undefined || value === null) return line;
						var newLine = (typeof value === 'number' || typeof value === 'boolean') 
							? key + ' = ' + value 
							: key + " = '" + String(value).replace(/'/g, "\\'") + "'";
						return indent + (enableLogging ? newLine : (trimmed.startsWith('#') ? line : '# ' + trimmed));
					}
				}
				
				if (booleanKeys.indexOf(trimmed.replace(/^#\s*/, '').split('=')[0].trim()) !== -1) {
					var keyMatch = trimmed.match(/^#?\s*(\w+)\s*=/);
					if (keyMatch && booleanKeys.indexOf(keyMatch[1]) !== -1) {
						var indent = line.match(/^(\s*)/)[1];
						var key = keyMatch[1];
						var value = updates[key];
						if (value === false) return trimmed.startsWith('#') ? line : indent + '# ' + trimmed;
						if (value === true) return indent + key + ' = true';
						return line;
					}
				}
				
				if (uncommentKeys.indexOf(trimmed.replace(/^#\s*/, '').split('=')[0].trim()) !== -1) {
					var keyMatch = trimmed.match(/^#?\s*(\w+)\s*=/);
					if (keyMatch && uncommentKeys.indexOf(keyMatch[1]) !== -1) {
						var indent = line.match(/^(\s*)/)[1];
						var key = keyMatch[1];
						var value = updates[key];
						if (value === undefined || value === null || value === '') {
							return trimmed.startsWith('#') ? line : indent + '# ' + trimmed;
						}
						var newLine = Array.isArray(value) 
							? key + ' = [' + value.map(function(v) { return typeof v === 'number' || typeof v === 'boolean' ? v : "'" + String(v).replace(/'/g, "\\'") + "'"; }).join(', ') + ']'
							: key + " = '" + String(value) + "'";
						return indent + newLine;
					}
				}
				
				if (inCommentBlock || trimmed.startsWith('#')) return line;
				
				var sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
				if (sectionMatch) { currentSection = sectionMatch[1]; return line; }
				
				var match = trimmed.match(/^(\w+)\s*=\s*(.*)$/);
				if (match) {
					var key = match[1];
					if (updates.hasOwnProperty(key) && loggingKeys.indexOf(key) === -1 && uncommentKeys.indexOf(key) === -1) {
						var newValue = updates[key];
						var newLine;
						if (Array.isArray(newValue)) {
							newLine = key + ' = [' + newValue.map(function(v) { return typeof v === 'number' || typeof v === 'boolean' ? v : "'" + String(v).replace(/'/g, "\\'") + "'"; }).join(', ') + ']';
						} else if (typeof newValue === 'boolean' || typeof newValue === 'number') {
							newLine = key + ' = ' + newValue;
						} else if (newValue === null || newValue === undefined) {
							newLine = '# ' + key + ' = ';
						} else {
							newLine = key + ' = ' + JSON.stringify(String(newValue));
						}
						var indent = line.match(/^(\s*)/)[1];
						return indent + newLine;
					}
				}
				return line;
			});
			
			var newContent = modifiedLines.join('\n');
			return fs.write(CONFIG_FILE, newContent);
		});
	},

	render: function(isRunning) {
		var config = parseToml(this.configContent || '');
		
		// Status section with styled badge
		var statusSection = E('div', { class: 'cbi-section' }, [
			E('div', { style: 'display:flex;align-items:center;gap:10px' }, [
				E('span', { style: 'font-weight:bold;font-size:16px' }, i18n('Service Status') + ': '),
				E('span', { id: 'service_status' }, isRunning ?
					E('span', { 
						style: 'display:inline-flex;align-items:center;padding:2px 10px;background:#4caf50;color:#fff;border-radius:12px;font-size:12px;font-weight:bold'
					}, [
						E('span', { 
							style: 'width:6px;height:6px;background:#fff;border-radius:50%;margin-right:6px'
						}),
						i18n('RUNNING')
					]) :
					E('span', { 
						style: 'display:inline-flex;align-items:center;padding:2px 10px;background:#f44336;color:#fff;border-radius:12px;font-size:12px;font-weight:bold'
					}, [
						E('span', { 
							style: 'width:6px;height:6px;background:#fff;border-radius:50%;margin-right:6px'
						}),
						i18n('NOT RUNNING')
					])
				)
			])
		]);
		
		// Control buttons with different colors
		var controlSection = E('div', { class: 'cbi-section', style: 'margin-top:15px' }, [
			E('button', {
				id: 'btn_start',
				type: 'button',
				class: 'btn',
				style: 'background:#4caf50;color:#fff;border:none;padding:2px 16px;border-radius:4px;cursor:pointer;margin-right:5px',
				disabled: isRunning ? 'disabled' : null,
				click: function(e) {
					e.preventDefault();
					fs.exec(INIT_SCRIPT, ['start']).then(function() {
						showNotification(null, i18n('Service started'), 'info');
					}).catch(function(err) {
						showNotification(null, err.message || JSON.stringify(err), 'error');
					});
				}
			}, [i18n('Start')]),
			E('button', {
				id: 'btn_stop',
				type: 'button',
				class: 'btn',
				style: 'background:#f44336;color:#fff;border:none;padding:2px 16px;border-radius:4px;cursor:pointer;margin-right:5px',
				disabled: isRunning ? null : 'disabled',
				click: function(e) {
					e.preventDefault();
					fs.exec(INIT_SCRIPT, ['stop']).then(function() {
						showNotification(null, i18n('Service stopped'), 'info');
					}).catch(function(err) {
						showNotification(null, err.message || JSON.stringify(err), 'error');
					});
				}
			}, [i18n('Stop')]),
			E('button', {
				id: 'btn_restart',
				type: 'button',
				class: 'btn',
				style: 'background:#2196f3;color:#fff;border:none;padding:2px 16px;border-radius:4px;cursor:pointer',
				click: function(e) {
					e.preventDefault();
					fs.exec(INIT_SCRIPT, ['restart']).then(function() {
						showNotification(null, i18n('Configuration reloaded'), 'info');
					}).catch(function(err) {
						showNotification(null, err.message || JSON.stringify(err), 'error');
					});
				}
			}, [i18n('Restart')])
		]);
		
		var tabs = [
			{ id: 'general', label: i18n('General') },
			{ id: 'servers', label: i18n('Servers') },
			{ id: 'connection', label: i18n('Connection') },
			{ id: 'network', label: i18n('Network') },
			{ id: 'balancing', label: i18n('Load Balancing') },
			{ id: 'caching', label: i18n('Caching') },
			{ id: 'filters', label: i18n('Filters') },
			{ id: 'certs', label: i18n('Certificates') },
			{ id: 'logging', label: i18n('Logging') },
			{ id: 'config_view', label: i18n('Configuration') }
		];
		
		var tabContent = {};
		var commented = config._commented || {};
		
		// Redirect DNS button
		var redirectDnsButton = E('button', {
			type: 'button',
			class: 'btn cbi-button cbi-button-action',
			style: 'margin-left:10px',
			click: function() {
				var listenAddr = document.querySelector('#dnscrypt-proxy-form input[name="listen_addresses"]').value.trim();
				if (!listenAddr) {
					ui.addNotification(null, E('p', i18n('Enter listen address')), 'error');
					return;
				}
				
				var dnsmasqAddr = listenAddr.replace(/:/g, '#');
				var sshCmd = 'uci add_list dhcp.@dnsmasq[0].server=' + dnsmasqAddr + ' && uci commit dhcp && /etc/init.d/dnsmasq restart';
				
				ui.addNotification(null, E('div', { style: 'font-size:14px' }, [
					E('p', { style: 'font-weight:bold;margin-bottom:15px;font-size:16px' }, i18n('Redirect DNS')),
					E('div', { style: 'background:#e8f5e9;padding:12px;border-radius:6px;margin-bottom:12px' }, [
						E('strong', {}, i18n('Method 1:')),
						E('p', { style: 'margin:5px 0 5px 10px' }, 'Network -> DHCP and DNS -> Advanced'),
						E('p', { style: 'margin:0 0 5px 10px' }, 'In DNS Forwardings field add:'),
						E('code', { style: 'background:#fff;padding:3px 8px;border-radius:3px;margin-left:10px' }, dnsmasqAddr)
					]),
					E('div', { style: 'background:#e3f2fd;padding:12px;border-radius:6px' }, [
						E('strong', {}, i18n('Method 2: SSH Terminal')),
						E('div', { style: 'display:flex;align-items:center;margin-top:8px' }, [
							E('code', { 
								style: 'flex:1;background:#263238;color:#fff;padding:10px 12px;border-radius:4px;font-size:13px;word-break:break-all;margin-right:10px' 
							}, sshCmd),
							E('button', {
								type: 'button',
								class: 'btn cbi-button cbi-button-action important',
								style: 'background:#1976d2;color:#fff;border:none;padding:8px 12px;border-radius:4px;cursor:pointer',
								click: function(e) {
									e.stopPropagation();
									var textarea = document.createElement('textarea');
									textarea.value = sshCmd;
									textarea.style.position = 'fixed';
									textarea.style.opacity = '0';
									document.body.appendChild(textarea);
									textarea.select();
									document.execCommand('copy');
									document.body.removeChild(textarea);
									ui.addNotification(null, E('p', i18n('Copied!')), 'info');
								}
							}, [i18n('Copy')])
						])
					])
				]), 'info');
			}
		}, [i18n('Redirect DNS')]);
		
		// Server selection button
		var selectServerButton = E('button', {
			type: 'button',
			class: 'btn cbi-button cbi-button-action',
			style: 'margin-left:10px',
			click: function() {
				// Get current selected servers
				var currentInput = document.querySelector('#dnscrypt-proxy-form input[name="server_names"]');
				var currentServers = currentInput ? currentInput.value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
				
				// Use LuCI's showModal
				var closeModal = ui.showModal(i18n('Available Servers'), [
					E('p', { class: 'cbi-section-descr' }, i18n('Search by name or address')),
					E('input', {
						type: 'text',
						class: 'cbi-input-text',
						style: 'width:100%;margin-bottom:15px',
						placeholder: i18n('Search by name or address'),
						input: function(e) {
							var search = e.target.value.toLowerCase();
							var rows = document.querySelectorAll('.server-row');
							rows.forEach(function(row) {
								var text = row.textContent.toLowerCase();
								row.style.display = text.includes(search) ? '' : 'none';
							});
						}
					}),
					E('div', {
						id: 'server-list-modal',
						style: 'max-height:50vh;overflow-y:auto'
					}, [
						E('div', { style: 'padding:20px;text-align:center' }, i18n('Loading servers...'))
					]),
					E('div', { style: 'margin-top:15px;display:flex;justify-content:space-between' }, [
						E('button', {
							type: 'button',
							class: 'btn cbi-button cbi-button-save',
							click: function() {
								// Update the input field with selected servers (comma-separated, no spaces)
								var input = document.querySelector('#dnscrypt-proxy-form input[name="server_names"]');
								if (input) {
									// Get all selected rows using data-selected attribute
									var selected = [];
									var rows = document.querySelectorAll('.server-row');
									rows.forEach(function(row) {
										if (row.getAttribute('data-selected') === 'true') {
											var name = row.getAttribute('data-name');
											if (name) selected.push(name);
										}
									});
									input.value = selected.join(',');
								}
								ui.hideModal();
							}
						}, i18n('Add to list')),
						E('button', {
							type: 'button',
							class: 'btn cbi-button cbi-button-negative',
							click: function() {
								ui.hideModal();
							}
						}, i18n('Close'))
					])
				]);

				// Load servers using fs.exec
				fs.exec('/usr/sbin/dnscrypt-proxy', ['-config', '/etc/dnscrypt-proxy2/dnscrypt-proxy.toml', '-list', '-json']).then(function(result) {
					var serverList = document.getElementById('server-list-modal');
					if (!serverList) return;
					
					// Parse JSON from stdout
					var servers = [];
					try {
						var output = result.stdout;
						if (output) {
							// Find JSON array in output
							var start = output.indexOf('[');
							var end = output.lastIndexOf(']') + 1;
							if (start >= 0 && end > start) {
								var jsonStr = output.substring(start, end);
								servers = JSON.parse(jsonStr);
							}
						}
					} catch (e) {
						console.error('Parse error:', e);
					}
					
					if (servers.length === 0) {
						serverList.innerHTML = E('div', { style: 'padding:20px;text-align:center;color:red' }, i18n('Error loading servers'));
						return;
					}
					
					// Sort servers alphabetically
					servers.sort(function(a, b) {
						return a.name.localeCompare(b.name);
					});
					
					// Get current selected servers
					var currentInput = document.querySelector('#dnscrypt-proxy-form input[name="server_names"]');
					var selectedServers = currentInput ? currentInput.value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
					
					var table = E('table', {
						class: 'table'
					}, [
						E('tr', { class: 'tr cbi-section-table-titles' }, [
							E('th', { class: 'th', style: 'width:30px' }, ''),
							E('th', { class: 'th' }, i18n('Server Name')),
							E('th', { class: 'th', style: 'width:100px' }, i18n('Protocol')),
							E('th', { class: 'th' }, i18n('Address'))
						])
					]);
					
					servers.forEach(function(server) {
						var isSelected = selectedServers.indexOf(server.name) >= 0;
						var row = E('tr', {
							class: 'tr server-row',
							'data-selected': isSelected ? 'true' : 'false',
							'data-name': server.name,
							style: isSelected ? 'background:#e8f5e9' : ''
						});
						
						var checkbox = E('input', {
							type: 'checkbox',
							checked: isSelected ? 'checked' : null,
							change: function(e) {
								e.stopPropagation();
								if (checkbox.checked) {
									row.setAttribute('data-selected', 'true');
									row.style.background = '#e8f5e9';
								} else {
									row.setAttribute('data-selected', 'false');
									row.style.background = '';
								}
							}
						});
						
						row.onclick = function(e) {
							if (e.target !== checkbox) {
								checkbox.checked = !checkbox.checked;
								var event = new Event('change', { bubbles: true });
								checkbox.dispatchEvent(event);
							}
						};
						
						row.innerHTML = 
							'<td class="td" style="text-align:center">' + '</td>' +
							'<td class="td" style="font-weight:bold">' + escapeHtml(server.name) + '</td>' +
							'<td class="td">' + escapeHtml(server.proto || '') + '</td>' +
							'<td class="td" style="font-size:12px;color:#666">' + escapeHtml((server.addrs || []).join(', ')) + '</td>';
						
						row.cells[0].appendChild(checkbox);
						table.appendChild(row);
					});
					
					serverList.innerHTML = '';
					serverList.appendChild(table);
					
				}).catch(function(err) {
					var serverList = document.getElementById('server-list-modal');
					if (serverList) {
						serverList.innerHTML = E('div', { style: 'padding:20px;text-align:center;color:red' }, 
							i18n('Error loading servers') + ': ' + (err.message || JSON.stringify(err)));
					}
				});
			}
		}, [i18n('Select Server')]);
		
		// Disabled servers selection button
		var selectDisabledServerButton = E('button', {
			type: 'button',
			class: 'btn cbi-button cbi-button-action',
			style: 'margin-left:10px',
			click: function() {
				// Get current disabled servers
				var currentInput = document.querySelector('#dnscrypt-proxy-form input[name="disabled_server_names"]');
				var currentServers = currentInput ? currentInput.value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
				
				// Use LuCI's showModal
				var closeModal = ui.showModal(i18n('Available Servers'), [
					E('p', { class: 'cbi-section-descr' }, i18n('Search by name or address')),
					E('input', {
						type: 'text',
						class: 'cbi-input-text',
						style: 'width:100%;margin-bottom:15px',
						placeholder: i18n('Search by name or address'),
						input: function(e) {
							var search = e.target.value.toLowerCase();
							var rows = document.querySelectorAll('.server-row');
							rows.forEach(function(row) {
								var text = row.textContent.toLowerCase();
								row.style.display = text.includes(search) ? '' : 'none';
							});
						}
					}),
					E('div', {
						id: 'server-list-modal-disabled',
						style: 'max-height:50vh;overflow-y:auto'
					}, [
						E('div', { style: 'padding:20px;text-align:center' }, i18n('Loading servers...'))
					]),
					E('div', { style: 'margin-top:15px;display:flex;justify-content:space-between' }, [
						E('button', {
							type: 'button',
							class: 'btn cbi-button cbi-button-save',
							click: function() {
								// Update the input field with selected servers (comma-separated, no spaces)
								var input = document.querySelector('#dnscrypt-proxy-form input[name="disabled_server_names"]');
								if (input) {
									// Get all selected rows using data-selected attribute
									var selected = [];
									var rows = document.querySelectorAll('.server-row');
									rows.forEach(function(row) {
										if (row.getAttribute('data-selected') === 'true') {
											var name = row.getAttribute('data-name');
											if (name) selected.push(name);
										}
									});
									input.value = selected.join(',');
								}
								ui.hideModal();
							}
						}, i18n('Add to list')),
						E('button', {
							type: 'button',
							class: 'btn cbi-button cbi-button-negative',
							click: function() {
								ui.hideModal();
							}
						}, i18n('Close'))
					])
				]);

				// Load servers using fs.exec
				fs.exec('/usr/sbin/dnscrypt-proxy', ['-config', '/etc/dnscrypt-proxy2/dnscrypt-proxy.toml', '-list', '-json']).then(function(result) {
					var serverList = document.getElementById('server-list-modal-disabled');
					if (!serverList) return;
					
					// Parse JSON from stdout
					var servers = [];
					try {
						var output = result.stdout;
						if (output) {
							var start = output.indexOf('[');
							var end = output.lastIndexOf(']') + 1;
							if (start >= 0 && end > start) {
								var jsonStr = output.substring(start, end);
								servers = JSON.parse(jsonStr);
							}
						}
					} catch (e) {
						console.error('Parse error:', e);
					}
					
					if (servers.length === 0) {
						serverList.innerHTML = E('div', { style: 'padding:20px;text-align:center;color:red' }, i18n('Error loading servers'));
						return;
					}
					
					// Sort servers alphabetically
					servers.sort(function(a, b) {
						return a.name.localeCompare(b.name);
					});
					
					// Get current selected servers
					var currentInput = document.querySelector('#dnscrypt-proxy-form input[name="disabled_server_names"]');
					var selectedServers = currentInput ? currentInput.value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
					
					var table = E('table', {
						class: 'table'
					}, [
						E('tr', { class: 'tr cbi-section-table-titles' }, [
							E('th', { class: 'th', style: 'width:30px' }, ''),
							E('th', { class: 'th' }, i18n('Server Name')),
							E('th', { class: 'th', style: 'width:100px' }, i18n('Protocol')),
							E('th', { class: 'th' }, i18n('Address'))
						])
					]);
					
					servers.forEach(function(server) {
						var isSelected = selectedServers.indexOf(server.name) >= 0;
						var row = E('tr', {
							class: 'tr server-row',
							'data-selected': isSelected ? 'true' : 'false',
							'data-name': server.name,
							style: isSelected ? 'background:#e8f5e9' : ''
						});
						
						var checkbox = E('input', {
							type: 'checkbox',
							checked: isSelected ? 'checked' : null,
							change: function(e) {
								e.stopPropagation();
								if (checkbox.checked) {
									row.setAttribute('data-selected', 'true');
									row.style.background = '#e8f5e9';
								} else {
									row.setAttribute('data-selected', 'false');
									row.style.background = '';
								}
							}
						});
						
						row.onclick = function(e) {
							if (e.target !== checkbox) {
								checkbox.checked = !checkbox.checked;
								var event = new Event('change', { bubbles: true });
								checkbox.dispatchEvent(event);
							}
						};
						
						row.innerHTML = 
							'<td class="td" style="text-align:center">' + '</td>' +
							'<td class="td" style="font-weight:bold">' + escapeHtml(server.name) + '</td>' +
							'<td class="td">' + escapeHtml(server.proto || '') + '</td>' +
							'<td class="td" style="font-size:12px;color:#666">' + escapeHtml((server.addrs || []).join(', ')) + '</td>';
						
						row.cells[0].appendChild(checkbox);
						table.appendChild(row);
					});
					
					serverList.innerHTML = '';
					serverList.appendChild(table);
					
				}).catch(function(err) {
					var serverList = document.getElementById('server-list-modal-disabled');
					if (serverList) {
						serverList.innerHTML = E('div', { style: 'padding:20px;text-align:center;color:red' }, 
							i18n('Error loading servers') + ': ' + (err.message || JSON.stringify(err)));
					}
				});
			}
		}, [i18n('Select Server')]);
		
		tabContent.general = E('div', {}, [
			renderTextField('listen_addresses', config['listen_addresses'], i18n('Listen Addresses'), getFieldDescription('listen_addresses'), null, redirectDnsButton),
			renderNumberField('max_clients', config['max_clients'], i18n('Max Clients'), getFieldDescription('max_clients')),
			renderTextField('user_name', config['user_name'], i18n('User Name'), getFieldDescription('user_name'), commented['user_name']),
			renderTextField('server_names', config['server_names'], i18n('Server Names'), getFieldDescription('server_names'), commented['server_names'], selectServerButton),
			renderTextField('disabled_server_names', config['disabled_server_names'], i18n('Disabled Servers'), getFieldDescription('disabled_server_names'), commented['disabled_server_names'], selectDisabledServerButton)
		]);
		
		tabContent.servers = E('div', {}, [
			renderCheckbox('ipv4_servers', config['ipv4_servers'], i18n('IPv4 Servers'), getFieldDescription('ipv4_servers')),
			renderCheckbox('ipv6_servers', config['ipv6_servers'], i18n('IPv6 Servers'), getFieldDescription('ipv6_servers')),
			renderCheckbox('dnscrypt_servers', config['dnscrypt_servers'], i18n('DNSCrypt Servers'), getFieldDescription('dnscrypt_servers')),
			renderCheckbox('doh_servers', config['doh_servers'], i18n('DoH Servers'), getFieldDescription('doh_servers')),
			renderCheckbox('odoh_servers', config['odoh_servers'], i18n('ODoH Servers'), getFieldDescription('odoh_servers')),
			renderCheckbox('require_dnssec', config['require_dnssec'], i18n('Require DNSSEC'), getFieldDescription('require_dnssec')),
			renderCheckbox('require_nolog', config['require_nolog'], i18n('No Logging'), getFieldDescription('require_nolog')),
			renderCheckbox('require_nofilter', config['require_nofilter'], i18n('No Filtering'), getFieldDescription('require_nofilter'))
		]);
		
		tabContent.connection = E('div', {}, [
			renderCheckbox('force_tcp', config['force_tcp'], i18n('Force TCP'), getFieldDescription('force_tcp')),
			renderCheckbox('http3', config['http3'], i18n('Enable HTTP/3'), getFieldDescription('http3')),
			renderCheckbox('http3_probe', config['http3_probe'], i18n('HTTP/3 Probe'), getFieldDescription('http3_probe')),
			renderNumberField('timeout', config['timeout'], i18n('Timeout (ms)'), getFieldDescription('timeout')),
			renderNumberField('keepalive', config['keepalive'], i18n('Keepalive (s)'), getFieldDescription('keepalive')),
			renderTextField('proxy', config['proxy'], i18n('SOCKS Proxy'), getFieldDescription('proxy'), commented['proxy']),
			renderTextField('http_proxy', config['http_proxy'], i18n('HTTP/HTTPS Proxy'), getFieldDescription('http_proxy'), commented['http_proxy']),
			renderTextField('blocked_query_response', config['blocked_query_response'], i18n('Blocked Query Response'), getFieldDescription('blocked_query_response'), commented['blocked_query_response'])
		]);
		
		tabContent.network = E('div', {}, [
			renderTextField('bootstrap_resolvers', config['bootstrap_resolvers'], i18n('Bootstrap Resolvers'), getFieldDescription('bootstrap_resolvers')),
			renderCheckbox('ignore_system_dns', config['ignore_system_dns'], i18n('Ignore System DNS'), getFieldDescription('ignore_system_dns')),
			renderNumberField('netprobe_timeout', config['netprobe_timeout'], i18n('Network Probe Timeout (s)'), getFieldDescription('netprobe_timeout')),
			renderTextField('netprobe_address', config['netprobe_address'], i18n('Network Probe Address'), getFieldDescription('netprobe_address')),
			renderCheckbox('offline_mode', config['offline_mode'], i18n('Offline Mode'), getFieldDescription('offline_mode'))
		]);
		
		var lbStrategyValue = config['lb_strategy'];
		if (!lbStrategyValue || !String(lbStrategyValue).trim()) {
			lbStrategyValue = 'wp2';
		}
		tabContent.balancing = E('div', {}, [
			renderSelect('lb_strategy', lbStrategyValue, i18n('Load Balancing Strategy'), [
				['wp2', 'wp2'],
				['p2', 'p2'],
				['p3', 'p3'],
				['p4', 'p4'],
				['p5', 'p5'],
				['ph', 'ph'],
				['first', 'first'],
				['random', 'random']
			], getFieldDescription('lb_strategy')),
			renderCheckbox('lb_estimator', config['lb_estimator'], i18n('Load Estimator'), getFieldDescription('lb_estimator')),
			renderCheckbox('enable_hot_reload', config['enable_hot_reload'], i18n('Hot Reload'), getFieldDescription('enable_hot_reload'))
		]);
		
		tabContent.caching = E('div', {}, [
			renderCheckbox('cache', config['cache'], i18n('Enable DNS Cache'), getFieldDescription('cache')),
			renderNumberField('cache_size', config['cache_size'], i18n('Cache Size'), getFieldDescription('cache_size')),
			renderNumberField('cache_min_ttl', config['cache_min_ttl'], i18n('Min TTL (s)'), getFieldDescription('cache_min_ttl')),
			renderNumberField('cache_max_ttl', config['cache_max_ttl'], i18n('Max TTL (s)'), getFieldDescription('cache_max_ttl')),
			renderNumberField('cache_neg_min_ttl', config['cache_neg_min_ttl'], i18n('Min Negative Cache TTL (s)'), getFieldDescription('cache_neg_min_ttl')),
			renderNumberField('cache_neg_max_ttl', config['cache_neg_max_ttl'], i18n('Max Negative Cache TTL (s)'), getFieldDescription('cache_neg_max_ttl'))
		]);
		
		tabContent.filters = E('div', {}, [
			renderCheckbox('block_ipv6', config['block_ipv6'], i18n('Block IPv6'), getFieldDescription('block_ipv6')),
			renderCheckbox('block_unqualified', config['block_unqualified'], i18n('Block Unqualified'), getFieldDescription('block_unqualified')),
			renderCheckbox('block_undelegated', config['block_undelegated'], i18n('Block Undelegated'), getFieldDescription('block_undelegated')),
			renderNumberField('reject_ttl', config['reject_ttl'], i18n('Reject TTL (s)'), getFieldDescription('reject_ttl'))
		]);
		
		tabContent.certs = E('div', {}, [
			renderNumberField('cert_refresh_delay', config['cert_refresh_delay'], i18n('Certificate Refresh (min)'), getFieldDescription('cert_refresh_delay')),
			renderCheckbox('cert_ignore_timestamp', config['cert_ignore_timestamp'], i18n('Ignore Certificate Timestamp'), getFieldDescription('cert_ignore_timestamp')),
			renderCheckbox('dnscrypt_ephemeral_keys', config['dnscrypt_ephemeral_keys'], i18n('DNSCrypt Ephemeral Keys'), getFieldDescription('dnscrypt_ephemeral_keys')),
			renderCheckbox('tls_disable_session_tickets', config['tls_disable_session_tickets'], i18n('Disable TLS Sessions'), getFieldDescription('tls_disable_session_tickets'))
		]);
		
		var loggingEnabled = true;
		var logFileLatest = config['log_file_latest'];
		if (logFileLatest === undefined || logFileLatest === null) {
			logFileLatest = true;
		}
		
		var logFilePath = config['log_file'];
		if (!logFilePath && loggingEnabled) {
			logFilePath = 'dnscrypt-proxy.log';
		}
		var fullLogPath = logFilePath ? (logFilePath.startsWith('/') ? logFilePath : '/etc/dnscrypt-proxy2/' + logFilePath) : '';
		
		tabContent.logging = E('div', {}, [
			renderCheckbox('enable_logging', loggingEnabled, i18n('Enable Logging'), getFieldDescription('enable_logging')),
			renderSelect('log_level', config['log_level'], i18n('Log Level'), [
				['0', '0 - Very Verbose'],
				['1', '1 - Verbose'],
				['2', '2 - Notice'],
				['3', '3 - Warning'],
				['4', '4 - Error'],
				['5', '5 - Critical'],
				['6', '6 - Fatal Only']
			], getFieldDescription('log_level')),
			renderTextField('log_file', config['log_file'], i18n('Log File'), getFieldDescription('log_file')),
			renderCheckbox('log_file_latest', logFileLatest, i18n('Latest Log Only'), getFieldDescription('log_file_latest')),
			renderCheckbox('use_syslog', config['use_syslog'], i18n('Use Syslog'), getFieldDescription('use_syslog')),
			renderNumberField('log_files_max_size', config['log_files_max_size'], i18n('Max Log Size (MB)'), getFieldDescription('log_files_max_size')),
			renderNumberField('log_files_max_age', config['log_files_max_age'], i18n('Max Log Age (days)'), getFieldDescription('log_files_max_age')),
			renderNumberField('log_files_max_backups', config['log_files_max_backups'], i18n('Max Backups'), getFieldDescription('log_files_max_backups')),
			
			loggingEnabled && fullLogPath ? E('div', { class: 'cbi-section', style: 'margin-top:20px' }, [
				E('h4', {}, i18n('Log Viewer')),
				E('div', { class: 'cbi-section-descr' }, i18n('File:') + ' ' + fullLogPath),
				E('button', {
					id: 'btn_refresh_log',
					type: 'button',
					class: 'btn cbi-button cbi-button-action',
					style: 'margin-bottom:10px',
					click: function(e) {
						e.preventDefault();
						var container = document.getElementById('log-view-content');
						if (container) {
							container.querySelector('pre').textContent = i18n('Loading...');
						}
						var callFileRead = rpc.declare({
							object: 'file',
							method: 'read',
							params: ['path']
						});
						callFileRead(fullLogPath).then(function(data) {
							var text = '';
							if (data) {
								if (typeof data === 'string') {
									text = data;
								} else if (data.data) {
									text = data.data;
								} else if (data.content) {
									text = data.content;
								} else {
									text = JSON.stringify(data);
								}
							}
							if (container) {
								container.querySelector('pre').textContent = text || '(empty)';
							}
						}).catch(function(e) {
							if (container) {
								container.querySelector('pre').textContent = i18n('Error') + ': ' + (e.message || JSON.stringify(e));
							}
						});
					}
				}, [i18n('Refresh')]),
				E('div', { 
					id: 'log-view-content',
					style: 'max-height:300px;overflow-y:auto'
				}, [
					E('pre', { style: 'margin:0;white-space:pre-wrap;word-wrap:break-word' }, i18n('Press "Refresh" to load logs'))
				])
			]) : null
		]);
		
		tabContent.config_view = E('div', { id: 'config-view-content' }, [
			E('div', { class: 'cbi-section' }, [
				E('div', { class: 'cbi-section-descr' }, [
					CONFIG_FILE
				]),
				E('div', { style: 'margin-bottom:10px' }, [
					E('button', {
						id: 'btn_refresh_config',
						class: 'btn cbi-button cbi-button-action',
						style: 'margin-right:10px',
						type: 'button',
						click: function(e) {
							e.preventDefault();
							var container = document.getElementById('config-view-content');
							var textarea = container.querySelector('textarea');
							if (textarea) {
								textarea.value = i18n('Loading...');
							}
							fs.read(CONFIG_FILE).then(function(content) {
								var container = document.getElementById('config-view-content');
								var textarea = container.querySelector('textarea');
								if (textarea) {
									textarea.value = content || '(empty)';
								}
							}).catch(function(e) {
								var container = document.getElementById('config-view-content');
								var textarea = container.querySelector('textarea');
								if (textarea) {
									textarea.value = i18n('Error') + ': ' + e.message;
								}
							});
						}
					}, [i18n('Refresh')]),
					E('button', {
						id: 'btn_save_config',
						class: 'btn cbi-button cbi-button-save',
						type: 'button',
						click: function(e) {
							e.preventDefault();
							var container = document.getElementById('config-view-content');
							var textarea = container.querySelector('textarea');
							if (textarea) {
								var content = textarea.value;
								fs.write(CONFIG_FILE, content).then(function() {
									ui.addNotification(null, E('p', i18n('Configuration saved. Restart service to apply changes.')), 'info');
								}).catch(function(e) {
									ui.addNotification(null, E('p', i18n('Error') + ': ' + e.message), 'error');
								});
							}
						}
					}, [i18n('Save')])
				]),
				E('textarea', {
					id: 'config-textarea',
					class: 'lua-cbi-terminal',
					style: 'width:100%;max-width:100%;min-height:400px;font-family:monospace;font-size:13px;padding:10px;box-sizing:border-box;white-space:pre;overflow:auto',
					spellcheck: false
				}, this.configContent || '(empty)')
			])
		]);
		
		// Build tabs
		var tabHeaders = E('ul', { class: 'cbi-tabmenu' });
		var tabBodies = [];
		
		for (var i = 0; i < tabs.length; i++) {
			var tab = tabs[i];
			var isActive = (i === 0);
			
			var tabHeader = E('li', { 
				class: isActive ? 'cbi-tab cbi-tab-selected' : 'cbi-tab-disabled',
				id: 'tab-' + tab.id,
				'data-tab': tab.id
			});
			tabHeader.appendChild(E('a', { href: '#' + tab.id }, tab.label));
			tabHeaders.appendChild(tabHeader);
			
			var tabBody = E('div', { 
				id: 'panel-' + tab.id,
				'data-tab': tab.id,
				style: isActive ? 'display:block' : 'display:none'
			}, [
				E('div', { class: 'cbi-section' }, [
					E('h3', {}, tab.label),
					tabContent[tab.id]
				])
			]);
			tabBodies.push(tabBody);
		}
		
		// Current servers section
		var serversSection = E('div', { id: 'current_servers', style: 'margin-top:20px' }, [
			E('h4', { style: 'margin:5px 0;font-weight:bold' }, i18n('Loading...'))
		]);
		
		// Main form
		var form = E('form', { 
			id: 'dnscrypt-proxy-form',
			submit: ui.createHandlerFn(this, 'handleSave')
		}, [
			E('h2', {}, i18n('DNSCrypt-Proxy 2')),
			statusSection,
			controlSection,
			serversSection,
			E('br'),
			tabHeaders,
			E('div', { class: 'cbi-section' }, tabBodies)
		]);
		
		// Tab switching
		setTimeout(function() {
			var tabList = document.querySelectorAll('#dnscrypt-proxy-form .cbi-tabmenu li');
			tabList.forEach(function(li) {
				li.style.cursor = 'pointer';
				li.onclick = function(e) {
					e.preventDefault();
					var tabId = li.getAttribute('data-tab');
					
					tabList.forEach(function(t) {
						t.className = 'cbi-tab-disabled';
					});
					li.className = 'cbi-tab cbi-tab-selected';
					
					var panels = document.querySelectorAll('#dnscrypt-proxy-form [data-tab]');
					panels.forEach(function(p) {
						if (p.getAttribute('data-tab') === tabId && p.id.startsWith('panel-')) {
							p.style.display = 'block';
						} else if (p.id.startsWith('panel-')) {
							p.style.display = 'none';
						}
					});
				};
			});
		}, 200);
		
		// Polling for status and servers
		setTimeout(function() {
			poll.add(function() {
				getServiceStatus().then(function(running) {
					var el = document.getElementById('service_status');
					if (el) {
						el.innerHTML = '';
						el.appendChild(running ? 
							E('div', { 
								style: 'display:inline-flex;align-items:center;padding:2px 10px;background:#4caf50;color:#fff;border-radius:12px;font-size:12px;font-weight:bold'
							}, [
								E('span', { 
									style: 'width:6px;height:6px;background:#fff;border-radius:50%;margin-right:6px'
								}),
								i18n('RUNNING')
							]) :
							E('div', { 
								style: 'display:inline-flex;align-items:center;padding:2px 10px;background:#f44336;color:#fff;border-radius:12px;font-size:12px;font-weight:bold'
							}, [
								E('span', { 
									style: 'width:6px;height:6px;background:#fff;border-radius:50%;margin-right:6px'
								}),
								i18n('NOT RUNNING')
							])
						);
					}
					var startBtn = document.getElementById('btn_start');
					var stopBtn = document.getElementById('btn_stop');
					if (startBtn) startBtn.disabled = running;
					if (stopBtn) stopBtn.disabled = !running;
				});
				
				getCurrentServers().then(function(servers) {
					var el = document.getElementById('current_servers');
					if (el) {
						if (servers && servers.length > 0) {
							el.innerHTML = '';
							el.appendChild(E('h4', { style: 'margin:5px 0;font-weight:bold' }, i18n('CURRENT SERVER') + ':'));
							servers.forEach(function(server) {
								el.appendChild(E('div', { style: 'margin-left:10px;margin-top:5px' }, '• ' + server));
							});
						} else {
							el.innerHTML = '';
							el.appendChild(E('h4', { style: 'margin:5px 0;font-weight:bold' }, i18n('SERVERS NOT DETERMINED')));
						}
					}
				}).catch(function(e) {
					var el = document.getElementById('current_servers');
					if (el) {
						el.innerHTML = '';
						el.appendChild(E('h4', { style: 'margin:5px 0;font-weight:bold' }, i18n('ERROR GETTING SERVERS')));
					}
				});
			}, 10);
		}, 1000);
		
		return form;
	}
});
