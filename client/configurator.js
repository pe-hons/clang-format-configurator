var example =
	'#include <iostream>\n' +
	'#include <algorithm>\n' +
	'#include <functional>\n' +
	'#include <iterator>\n' +
	'#include <cstdlib>\n' +
	'#include <ctime>\n' +
	'\n' +
	'template <typename T, int size> bool is_sorted(T(&array)[size]) {\n' +
	'  return std::adjacent_find(array, array + size, std::greater<T>()) ==\n' +
	'         array + size;\n' +
	'}\n' +
	'\n' +
	'int main() {\n' +
	'  std::srand(std::time(0));\n' +
	'\n' +
	'  int list[] = {1, 2, 3, 4, 5, 6, 7, 8, 9};\n' +
	'\n' +
	'  do {\n' +
	'    std::random_shuffle(list, list + 9);\n' +
	'  } while (is_sorted(list));\n' +
	'\n' +
	'  int score = 0;\n' +
	'\n' +
	'  do {\n' +
	'    std::cout << "Current list: ";\n' +
	'    std::copy(list, list + 9, std::ostream_iterator<int>(std::cout, " "));\n' +
	'\n' +
	'    int rev;\n' +
	'    while (true) {\n' +
	'      std::cout << "\\nDigits to reverse? ";\n' +
	'      std::cin >> rev;\n' +
	'      if (rev > 1 && rev < 10)\n' +
	'        break;\n' +
	'      std::cout << "Please enter a value between 2 and 9.";\n' +
	'    }\n' +
	'\n' +
	'    ++score;\n' +
	'    std::reverse(list, list + rev);\n' +
	'  } while (!is_sorted(list));\n' +
	'\n' +
	'  std::cout << "Congratulations, you sorted the list.\\n"\n' +
	'            << "You needed " << score << " reversals." << std::endl;\n' +
	'  return 0;\n' +
	'}\n';

var code;
var clang_options;
var clang_version;

$(document).ready(function(){
	sourceCode = localStorage.getItem('sourceCode');
	if(!sourceCode) {
		sourceCode = example;
	};

	code = ace.edit('code');
	code.setTheme('ace/theme/twilight');
	code.getSession().setMode('ace/mode/c_cpp');
	code.getSession().setUseSoftTabs(false);
	code.getSession().setTabSize(2);
	code.getSession().setUseWrapMode(false);
	code.setOption('showInvisibles', true);
	code.setPrintMarginColumn(80);
	code.$blockScrolling = Infinity;
	code.getSession().on('change', save_state);

	load_doc(sourceCode);

	$('#update_button').on('click', function(evt){
		request_update(clang_options, clang_version);
	});
	$('#save_button').on('click', function(evt){
		save_config(clang_options, clang_version);
	});
	$('#reset_button').on('click', function(evt){
		clang_version = undefined;
		localStorage.removeItem('sourceCode');
		localStorage.removeItem('options');
		load_doc(example);
	});
	$('#load_button').on('change', load_config);
});

function load_doc(sourceCode) {
  $.ajax({
    url: clang_format_config.url + ':' + clang_format_config.port + '/doc',
    type: 'GET',
    dataType: 'json',
    crossDomain: true,
    success: function(options) {
      create_inputs(options);
      request_update(clang_options, clang_version, sourceCode);
    },
    error: handle_ajax_error
  });
}

function update_code(data){
	var range = code.selection.getRange();
	code.getSession().setValue(data);
	code.selection.setRange(range);
}

function save_state() {
  if (clang_options && clang_version) {
    localStorage.setItem('sourceCode', code.getSession().getValue());
    localStorage.setItem('options', JSON.stringify({
      'version': clang_version,
      'options': get_config(clang_options, clang_version)
    }));
  }
}

function request_update(clang_options, version, source=null){
	var new_config = get_config(clang_options, version);
	code.getSession().setTabSize(new_config.TabWidth || 2);
	code.setPrintMarginColumn(new_config.ColumnLimit || 80);
	var range = code.selection.getRange();

	source = source || code.getSession().getValue();

	var options = {
		config: JSON.stringify(new_config),
		version: version,
		code: source
	};

	if(range.start.row != range.end.row && range.start.column != range.end.column)
		options.range = range.start.row + ':' + range.end.row;

	$('#code').css('background-color', 'rgba(0,0,0,0.5) !important');
	$.ajax({
		url: clang_format_config.url + ':' + clang_format_config.port + '/format',
		type: 'POST',
		dataType: 'json',
		crossDomain: true,
		success: update_code,
		error: handle_ajax_error,
		complete: function() {$('#code').css('background-color', '');},
		data: options
	});
}

function load_config(evt){
	_.each(evt.target.files, function(file){
		var reader = new FileReader();
		reader.onload = function(load_event){
			var yml = load_event.target.result;
			try{
				data = window.YAML.parse(yml);
			}
			catch(err){
				alert('The file you uploaded does not appear to be a valid YAML file:\n' + err.message);
			}

			_.each(data, function(value, key){
				var clang_option = clang_options[clang_version][key];
				if(clang_option) {
					if(typeof(value) === "boolean") {
						value = value.toString();
					}
					$('#' + key).val(value);
				}
				else
				{
					console.log(key, value);
				}
			});
			request_update(clang_options, clang_version);
		};
		reader.readAsText(file);
	});
	evt.target.value = '';
}

function save_config(clang_options, version){
	var config = get_config(clang_options, version);
	var yml;
	if(_.size(config))
		yml = window.YAML.stringify(config);
	else
		yml = '';
	var blob = new Blob(['---\n',yml,'\n...\n'], {type: 'text/plain;charset=utf-8'});
	saveAs(blob, '.clang-format');
}


function get_config(options, version){
	var result = {};
	$.each(options[version], function(key, value){
		var option_value = $('#' + key).val();
		if(option_value && option_value !== 'Default')
			result[key] = option_value;
	});
	return result;
}

function create_inputs(options){

	var container = $('#options');
	var storedState = JSON.parse(localStorage.getItem('options'));
	var origVersion = clang_version

	if(typeof(clang_version) === 'undefined')
	{
		clang_options = options;
		clang_version = storedState && storedState.version;
		if(!clang_version || !options.versions.includes(clang_version)) {
			clang_version = options.versions[0];
		};

		$('#version').html(select_input('clang_version', options.versions));

		$('#clang_version').val(clang_version);
		$('#clang_version').on('change', function(evt){
			clang_version = $('#clang_version').val();
			create_inputs(options);
			request_update(clang_options, clang_version);
		});
	}

	var currentConfig = {};
	if (storedState && storedState.version == clang_version)
	{
		currentConfig = storedState.options;
	}
	if (clang_options && origVersion)
	{
		$.extend(currentConfig, get_config(clang_options, origVersion));
	}

	container.empty();
	$.each(options[clang_version], function(key, value){
		var input = create_input(key, value);
		$(input).appendTo(container);
	});

	$.each(currentConfig, function(key, value){
		var clang_option = clang_options[clang_version][key];
		if(clang_option){
			$('#' + key).val(value);
		}
	});

	$('.form-control').on('change', function(evt){
		request_update(clang_options, clang_version);
	});
}

function create_input(option_name, option_details){
	var input_template;
	if($.isArray(option_details.options))
		input_template = select_input(option_name, ['Default'].concat(option_details.options));
	else if(option_details.type === 'bool')
		input_template = select_input(option_name, ['Default', true, false]);
	else if(option_details.type === 'std::string' || option_details.type === 'string')
		input_template = string_input(option_name);
	else if(option_details.type === 'std::vector<std::string>')
		input_template = string_input(option_name);
	else if(option_details.type === 'int')
		input_template = int_input(option_name);
	else if(option_details.type === 'unsigned')
		input_template = int_input(option_name, 0);
	else
	{
		console.log('No input created for ' + option_name + ' (type: ' + option_details.type + ')');
	}

	var template =
		'<div class="form-group">' +
		'	<label class="col-sm-8">' +
		'		<a href="#<%= option_name %>_collapse" data-toggle="collapse"><i class="fa fa-info-circle"></i></a>' +
		'		<%= option_name %>:' +
		'	</label>' +
		'	<div class="col-sm-4">' +
		input_template +
		'	</div>' +
		'</div>' +
		'<div class="collapse" id="<%= option_name %>_collapse">' +
		'	<div class="well">' +
		'		<%= option_doc %>' +
		'	</div>' +
		'</div>';

	return _.template(template)({
		option_name: option_name,
		option_doc:  option_details.doc
	});
}

function select_input(option_name, options){
	var template =
		'		<select id="<%= option_name %>" class="form-control">' +
		'			<% _.forEach(options, function(option){%>' +
		'				<option value="<%= option %>"><%= option %></option>' +
		'			<%});%>' +
		'		</select>';
	return _.template(template)({
		option_name: option_name,
		options:     options
	});
}

function string_input(option_name){
	var template =
		'<input type="text" class="form-control" id="<%= option_name %>" placeholder="Default"/>';
	return _.template(template)({
		option_name: option_name
	});
}

function int_input(option_name, min){
	var template =
		'<input type="number" class="form-control" id="<%= option_name %>" placeholder="Default" min="<%= min %>" />';

	return _.template(template)({
		option_name: option_name,
		min:         min
	});
}

function handle_ajax_error(err){
	console.log(err);
	$('#error_content').text(err.statusText);
	$('#error_modal').modal('show');
}
