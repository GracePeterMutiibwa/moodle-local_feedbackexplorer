<?php
require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/feedback/lib.php');

$feedbackid = required_param('feedbackid', PARAM_INT);
$cmid       = required_param('cmid', PARAM_INT);

list($course, $cm) = get_course_and_cm_from_cmid($cmid, 'feedback');
$context = context_module::instance($cm->id);

require_login($course, true, $cm);
require_capability('mod/feedback:viewreports', $context);

$feedback = $DB->get_record('feedback', ['id' => $feedbackid], '*', MUST_EXIST);

$PAGE->set_url('/local/feedbackexplorer/explorer.php', [
    'feedbackid' => $feedbackid,
    'cmid'       => $cmid,
]);
$PAGE->set_context($context);
$PAGE->set_course($course);
$PAGE->set_cm($cm);
$PAGE->set_title('Explorer: ' . format_string($feedback->name));
$PAGE->set_heading(format_string($course->fullname));

// Load normalized data
require_once(__DIR__ . '/classes/feedback_data.php');
$extractor = new local_feedbackexplorer\feedback_data($feedbackid, $context);
$data      = $extractor->get_normalized_data();

// Load saved user preferences
$saved_baseurl  = get_config('local_feedbackexplorer', 'baseurl') ?: '';
$saved_apikey   = get_config('local_feedbackexplorer', 'apikey') ?: '';
$saved_models   = get_config('local_feedbackexplorer', 'models') ?: '';
$saved_default  = get_config('local_feedbackexplorer', 'default_model') ?: '';
$saved_prompt   = get_config('local_feedbackexplorer', 'sysprompt') ?: "You are an academic...";
$json_data = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

echo $OUTPUT->header();
?>

<link rel="stylesheet" href="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/css/explorer.css">

<link rel="stylesheet" href="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/css/katex.min.css">
<link rel="stylesheet" media="(prefers-color-scheme: light)" href="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/css/atom-one-light.min.css">
<link rel="stylesheet" media="(prefers-color-scheme: dark)" href="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/css/atom-one-dark.min.css">


<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/katex.min.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/highlight.min.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/mermaid.min.js"></script>

<div id="feedback-explorer-root">

    
    <ul class="nav nav-tabs" id="explorerTabs">
        <li class="nav-item">
            <a class="nav-link active" href="#tab-report">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4.69434V18.6943C4 20.3512 5.34315 21.6943 7 21.6943H17C18.6569 21.6943 20 20.3512 20 18.6943V8.69434C20 7.03748 18.6569 5.69434 17 5.69434H5C4.44772 5.69434 4 5.24662 4 4.69434ZM7.25 11.6943C7.25 11.2801 7.58579 10.9443 8 10.9443H16C16.4142 10.9443 16.75 11.2801 16.75 11.6943C16.75 12.1085 16.4142 12.4443 16 12.4443H8C7.58579 12.4443 7.25 12.1085 7.25 11.6943ZM7.25 15.1943C7.25 14.7801 7.58579 14.4443 8 14.4443H13.5C13.9142 14.4443 14.25 14.7801 14.25 15.1943C14.25 15.6085 13.9142 15.9443 13.5 15.9443H8C7.58579 15.9443 7.25 15.6085 7.25 15.1943Z" fill="#1C274D"></path> <path opacity="0.5" d="M18 4.00038V5.86504C17.6872 5.75449 17.3506 5.69434 17 5.69434H5C4.44772 5.69434 4 5.24662 4 4.69434V4.62329C4 4.09027 4.39193 3.63837 4.91959 3.56299L15.7172 2.02048C16.922 1.84835 18 2.78328 18 4.00038Z" fill="#1C274D"></path> </g></svg>
                <span>Report</span>
            </a>
        </li>
        <?php if (is_siteadmin()) : ?>
        <li class="nav-item">
            <a class="nav-link" href="#tab-settings">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M14.2788 2.15224C13.9085 2 13.439 2 12.5 2C11.561 2 11.0915 2 10.7212 2.15224C10.2274 2.35523 9.83509 2.74458 9.63056 3.23463C9.53719 3.45834 9.50065 3.7185 9.48635 4.09799C9.46534 4.65568 9.17716 5.17189 8.69017 5.45093C8.20318 5.72996 7.60864 5.71954 7.11149 5.45876C6.77318 5.2813 6.52789 5.18262 6.28599 5.15102C5.75609 5.08178 5.22018 5.22429 4.79616 5.5472C4.47814 5.78938 4.24339 6.1929 3.7739 6.99993C3.30441 7.80697 3.06967 8.21048 3.01735 8.60491C2.94758 9.1308 3.09118 9.66266 3.41655 10.0835C3.56506 10.2756 3.77377 10.437 4.0977 10.639C4.57391 10.936 4.88032 11.4419 4.88029 12C4.88026 12.5581 4.57386 13.0639 4.0977 13.3608C3.77372 13.5629 3.56497 13.7244 3.41645 13.9165C3.09108 14.3373 2.94749 14.8691 3.01725 15.395C3.06957 15.7894 3.30432 16.193 3.7738 17C4.24329 17.807 4.47804 18.2106 4.79606 18.4527C5.22008 18.7756 5.75599 18.9181 6.28589 18.8489C6.52778 18.8173 6.77305 18.7186 7.11133 18.5412C7.60852 18.2804 8.2031 18.27 8.69012 18.549C9.17714 18.8281 9.46533 19.3443 9.48635 19.9021C9.50065 20.2815 9.53719 20.5417 9.63056 20.7654C9.83509 21.2554 10.2274 21.6448 10.7212 21.8478C11.0915 22 11.561 22 12.5 22C13.439 22 13.9085 22 14.2788 21.8478C14.7726 21.6448 15.1649 21.2554 15.3694 20.7654C15.4628 20.5417 15.4994 20.2815 15.5137 19.902C15.5347 19.3443 15.8228 18.8281 16.3098 18.549C16.7968 18.2699 17.3914 18.2804 17.8886 18.5412C18.2269 18.7186 18.4721 18.8172 18.714 18.8488C19.2439 18.9181 19.7798 18.7756 20.2038 18.4527C20.5219 18.2105 20.7566 17.807 21.2261 16.9999C21.6956 16.1929 21.9303 15.7894 21.9827 15.395C22.0524 14.8691 21.9088 14.3372 21.5835 13.9164C21.4349 13.7243 21.2262 13.5628 20.9022 13.3608C20.4261 13.0639 20.1197 12.558 20.1197 11.9999C20.1197 11.4418 20.4261 10.9361 20.9022 10.6392C21.2263 10.4371 21.435 10.2757 21.5836 10.0835C21.9089 9.66273 22.0525 9.13087 21.9828 8.60497C21.9304 8.21055 21.6957 7.80703 21.2262 7C20.7567 6.19297 20.522 5.78945 20.2039 5.54727C19.7799 5.22436 19.244 5.08185 18.7141 5.15109C18.4722 5.18269 18.2269 5.28136 17.8887 5.4588C17.3915 5.71959 16.7969 5.73002 16.3099 5.45096C15.8229 5.17191 15.5347 4.65566 15.5136 4.09794C15.4993 3.71848 15.4628 3.45833 15.3694 3.23463C15.1649 2.74458 14.7726 2.35523 14.2788 2.15224Z" fill="#1C274C"></path> <path d="M15.5227 12C15.5227 13.6569 14.1694 15 12.4999 15C10.8304 15 9.47705 13.6569 9.47705 12C9.47705 10.3431 10.8304 9 12.4999 9C14.1694 9 15.5227 10.3431 15.5227 12Z" fill="#1C274C"></path> </g></svg>
                <span>Settings</span>
            </a>
        </li>
        <?php endif; ?>
    </ul>

    <div class="tab-content" id="explorerTabContent">

       
        <div class="tab-pane fade show active" id="tab-report">
            <div class="explorer-toolbar">
                <h4><?php echo format_string($feedback->name); ?></h4>
                <div class="toolbar-actions">
                    <button id="btn-generate" class="app-styled app-styled--primary">
                        <svg class="btn-icon btn-icon--default" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M3.84453 3.84453C2.71849 4.97056 2.71849 6.79623 3.84453 7.92226L5.43227 9.51C5.44419 9.49622 5.98691 10.013 6 9.99989L10 5.99989C10.0131 5.98683 9.49625 5.44415 9.50999 5.43226L7.92226 3.84453C6.79623 2.71849 4.97056 2.71849 3.84453 3.84453Z" fill="#1C274C"/><path opacity="0.5" d="M5.1332 15.3072C5.29414 14.8976 5.87167 14.8976 6.03261 15.3072L6.18953 15.7065C6.23867 15.8316 6.33729 15.9306 6.46188 15.9799L6.85975 16.1374C7.26783 16.2989 7.26783 16.8786 6.85975 17.0401L6.46188 17.1976C6.33729 17.2469 6.23867 17.3459 6.18953 17.471L6.03261 17.8703C5.87167 18.2799 5.29414 18.2799 5.1332 17.8703L4.97628 17.471C4.92714 17.3459 4.82852 17.2469 4.70393 17.1976L4.30606 17.0401C3.89798 16.8786 3.89798 16.2989 4.30606 16.1374L4.70393 15.9799C4.82852 15.9306 4.92714 15.8316 4.97628 15.7065L5.1332 15.3072Z" fill="#1C274C"/><path opacity="0.2" d="M19.9672 9.12945C20.1281 8.71987 20.7057 8.71987 20.8666 9.12945L21.0235 9.5288C21.0727 9.65385 21.1713 9.75284 21.2959 9.80215L21.6937 9.95965C22.1018 10.1212 22.1018 10.7009 21.6937 10.8624L21.2959 11.0199C21.1713 11.0692 21.0727 11.1682 21.0235 11.2932L20.8666 11.6926C20.7057 12.1022 20.1281 12.1022 19.9672 11.6926L19.8103 11.2932C19.7611 11.1682 19.6625 11.0692 19.5379 11.0199L19.14 10.8624C18.732 10.7009 18.732 10.1212 19.14 9.95965L19.5379 9.80215C19.6625 9.75284 19.7611 9.65385 19.8103 9.5288L19.9672 9.12945Z" fill="#1C274C"/><path opacity="0.7" d="M16.1 2.30719C16.261 1.8976 16.8385 1.8976 16.9994 2.30719L17.4298 3.40247C17.479 3.52752 17.5776 3.62651 17.7022 3.67583L18.7934 4.1078C19.2015 4.26934 19.2015 4.849 18.7934 5.01054L17.7022 5.44252C17.5776 5.49184 17.479 5.59082 17.4298 5.71587L16.9995 6.81115C16.8385 7.22074 16.261 7.22074 16.1 6.81116L15.6697 5.71587C15.6205 5.59082 15.5219 5.49184 15.3973 5.44252L14.3061 5.01054C13.898 4.849 13.898 4.26934 14.3061 4.1078L15.3973 3.67583C15.5219 3.62651 15.6205 3.52752 15.6697 3.40247L16.1 2.30719Z" fill="#1C274C"/><path d="M10.5681 6.48999C10.5562 6.50373 10.0133 5.9867 10.0002 5.99975L6.00024 9.99975C5.98715 10.0128 6.50414 10.5558 6.49036 10.5677L16.078 20.1553C17.204 21.2814 19.0297 21.2814 20.1557 20.1553C21.2818 19.0293 21.2818 17.2036 20.1557 16.0776L10.5681 6.48999Z" fill="#1C274C"/></svg>
                        <svg class="btn-icon btn-icon--hover" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M3.84453 3.84453C2.71849 4.97056 2.71849 6.79623 3.84453 7.92226L5.43227 9.51C5.44419 9.49622 5.98691 10.013 6 9.99989L10 5.99989C10.0131 5.98683 9.49625 5.44415 9.50999 5.43226L7.92226 3.84453C6.79623 2.71849 4.97056 2.71849 3.84453 3.84453Z" fill="#00a6f4"/><path opacity="0.5" d="M5.1332 15.3072C5.29414 14.8976 5.87167 14.8976 6.03261 15.3072L6.18953 15.7065C6.23867 15.8316 6.33729 15.9306 6.46188 15.9799L6.85975 16.1374C7.26783 16.2989 7.26783 16.8786 6.85975 17.0401L6.46188 17.1976C6.33729 17.2469 6.23867 17.3459 6.18953 17.471L6.03261 17.8703C5.87167 18.2799 5.29414 18.2799 5.1332 17.8703L4.97628 17.471C4.92714 17.3459 4.82852 17.2469 4.70393 17.1976L4.30606 17.0401C3.89798 16.8786 3.89798 16.2989 4.30606 16.1374L4.70393 15.9799C4.82852 15.9306 4.92714 15.8316 4.97628 15.7065L5.1332 15.3072Z" fill="#00a6f4"/><path opacity="0.2" d="M19.9672 9.12945C20.1281 8.71987 20.7057 8.71987 20.8666 9.12945L21.0235 9.5288C21.0727 9.65385 21.1713 9.75284 21.2959 9.80215L21.6937 9.95965C22.1018 10.1212 22.1018 10.7009 21.6937 10.8624L21.2959 11.0199C21.1713 11.0692 21.0727 11.1682 21.0235 11.2932L20.8666 11.6926C20.7057 12.1022 20.1281 12.1022 19.9672 11.6926L19.8103 11.2932C19.7611 11.1682 19.6625 11.0692 19.5379 11.0199L19.14 10.8624C18.732 10.7009 18.732 10.1212 19.14 9.95965L19.5379 9.80215C19.6625 9.75284 19.7611 9.65385 19.8103 9.5288L19.9672 9.12945Z" fill="#00a6f4"/><path opacity="0.7" d="M16.1 2.30719C16.261 1.8976 16.8385 1.8976 16.9994 2.30719L17.4298 3.40247C17.479 3.52752 17.5776 3.62651 17.7022 3.67583L18.7934 4.1078C19.2015 4.26934 19.2015 4.849 18.7934 5.01054L17.7022 5.44252C17.5776 5.49184 17.479 5.59082 17.4298 5.71587L16.9995 6.81115C16.8385 7.22074 16.261 7.22074 16.1 6.81116L15.6697 5.71587C15.6205 5.59082 15.5219 5.49184 15.3973 5.44252L14.3061 5.01054C13.898 4.849 13.898 4.26934 14.3061 4.1078L15.3973 3.67583C15.5219 3.62651 15.6205 3.52752 15.6697 3.40247L16.1 2.30719Z" fill="#00a6f4"/><path d="M10.5681 6.48999C10.5562 6.50373 10.0133 5.9867 10.0002 5.99975L6.00024 9.99975C5.98715 10.0128 6.50414 10.5558 6.49036 10.5677L16.078 20.1553C17.204 21.2814 19.0297 21.2814 20.1557 20.1553C21.2818 19.0293 21.2818 17.2036 20.1557 16.0776L10.5681 6.48999Z" fill="#00a6f4"/></svg>
                        Generate Report
                    </button>

                    <button id="btn-export" class="app-styled app-styled--secondary" style="display:none">
                        <svg class="btn-icon btn-icon--default" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M10 22H14C17.7712 22 19.6569 22 20.8284 20.8284C22 19.6569 22 17.7712 22 14V13.5629C22 12.6901 22 12.0344 21.9574 11.5001H18L17.9051 11.5001C16.808 11.5002 15.8385 11.5003 15.0569 11.3952C14.2098 11.2813 13.3628 11.0198 12.6716 10.3285C11.9803 9.63726 11.7188 8.79028 11.6049 7.94316C11.4998 7.16164 11.4999 6.19207 11.5 5.09497L11.5092 2.26057C11.5095 2.17813 11.5166 2.09659 11.53 2.01666C11.1214 2 10.6358 2 10.0298 2C6.23869 2 4.34315 2 3.17157 3.17157C2 4.34315 2 6.22876 2 10V14C2 17.7712 2 19.6569 3.17157 20.8284C4.34315 22 6.22876 22 10 22Z" fill="#1C274C"/><path d="M9.01296 19.0472C8.72446 19.3176 8.27554 19.3176 7.98705 19.0472L5.98705 17.1722C5.68486 16.8889 5.66955 16.4142 5.95285 16.112C6.23615 15.8099 6.71077 15.7945 7.01296 16.0778L7.75 16.7688V13.5C7.75 13.0858 8.08579 12.75 8.5 12.75C8.91422 12.75 9.25 13.0858 9.25 13.5L9.25 16.7688L9.98705 16.0778C10.2892 15.7945 10.7639 15.8099 11.0472 16.112C11.3305 16.4142 11.3151 16.8889 11.013 17.1722L9.01296 19.0472Z" fill="#1C274C"/><path d="M11.5092 2.2601L11.5 5.0945C11.4999 6.1916 11.4998 7.16117 11.6049 7.94269C11.7188 8.78981 11.9803 9.6368 12.6716 10.3281C13.3629 11.0193 14.2098 11.2808 15.057 11.3947C15.8385 11.4998 16.808 11.4997 17.9051 11.4996L21.9574 11.4996C21.9698 11.6552 21.9786 11.821 21.9848 11.9995H22C22 11.732 22 11.5983 21.9901 11.4408C21.9335 10.5463 21.5617 9.52125 21.0315 8.79853C20.9382 8.6713 20.8743 8.59493 20.7467 8.44218C19.9542 7.49359 18.911 6.31193 18 5.49953C17.1892 4.77645 16.0787 3.98536 15.1101 3.3385C14.2781 2.78275 13.862 2.50487 13.2915 2.29834C13.1403 2.24359 12.9408 2.18311 12.7846 2.14466C12.4006 2.05013 12.0268 2.01725 11.5 2.00586L11.5092 2.2601Z" fill="#1C274C"/></svg>
                        <svg class="btn-icon btn-icon--hover" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" fill-rule="evenodd" clip-rule="evenodd" d="M10 22H14C17.7712 22 19.6569 22 20.8284 20.8284C22 19.6569 22 17.7712 22 14V13.5629C22 12.6901 22 12.0344 21.9574 11.5001H18L17.9051 11.5001C16.808 11.5002 15.8385 11.5003 15.0569 11.3952C14.2098 11.2813 13.3628 11.0198 12.6716 10.3285C11.9803 9.63726 11.7188 8.79028 11.6049 7.94316C11.4998 7.16164 11.4999 6.19207 11.5 5.09497L11.5092 2.26057C11.5095 2.17813 11.5166 2.09659 11.53 2.01666C11.1214 2 10.6358 2 10.0298 2C6.23869 2 4.34315 2 3.17157 3.17157C2 4.34315 2 6.22876 2 10V14C2 17.7712 2 19.6569 3.17157 20.8284C4.34315 22 6.22876 22 10 22Z" fill="#00a6f4"/><path d="M9.01296 19.0472C8.72446 19.3176 8.27554 19.3176 7.98705 19.0472L5.98705 17.1722C5.68486 16.8889 5.66955 16.4142 5.95285 16.112C6.23615 15.8099 6.71077 15.7945 7.01296 16.0778L7.75 16.7688V13.5C7.75 13.0858 8.08579 12.75 8.5 12.75C8.91422 12.75 9.25 13.0858 9.25 13.5L9.25 16.7688L9.98705 16.0778C10.2892 15.7945 10.7639 15.8099 11.0472 16.112C11.3305 16.4142 11.3151 16.8889 11.013 17.1722L9.01296 19.0472Z" fill="#00a6f4"/><path d="M11.5092 2.2601L11.5 5.0945C11.4999 6.1916 11.4998 7.16117 11.6049 7.94269C11.7188 8.78981 11.9803 9.6368 12.6716 10.3281C13.3629 11.0193 14.2098 11.2808 15.057 11.3947C15.8385 11.4998 16.808 11.4997 17.9051 11.4996L21.9574 11.4996C21.9698 11.6552 21.9786 11.821 21.9848 11.9995H22C22 11.732 22 11.5983 21.9901 11.4408C21.9335 10.5463 21.5617 9.52125 21.0315 8.79853C20.9382 8.6713 20.8743 8.59493 20.7467 8.44218C19.9542 7.49359 18.911 6.31193 18 5.49953C17.1892 4.77645 16.0787 3.98536 15.1101 3.3385C14.2781 2.78275 13.862 2.50487 13.2915 2.29834C13.1403 2.24359 12.9408 2.18311 12.7846 2.14466C12.4006 2.05013 12.0268 2.01725 11.5 2.00586L11.5092 2.2601Z" fill="#00a6f4"/></svg>
                        Export PDF
                    </button>
                </div>
            </div>
            <div id="report-area"></div>
        </div>

        
        <?php if (is_siteadmin()) : ?>
        <div class="tab-pane fade" id="tab-settings">
            <div class="settings-form">
                <h4>LLM Connection Settings</h4>

                <div class="form-group">
                    <label>API Base URL</label>
                    <input type="text" id="cfg-baseurl" class="form-control"
                        placeholder="https://openrouter.ai/api/v1"
                        value="<?php echo s($saved_baseurl); ?>">
                </div>

                <div class="form-group">
                    <label>API Key</label>
                    <input type="password" id="cfg-apikey" class="form-control"
                        placeholder="sk-..."
                        value="<?php echo s($saved_apikey); ?>">
                </div>

                <div class="form-group">
                    <label>Model IDs <small class="text-muted">(one per line)</small></label>
                    <textarea id="cfg-models" class="form-control" rows="5"
                        placeholder="openai/gpt-4o&#10;anthropic/claude-3-5-sonnet&#10;mistralai/mistral-7b-instruct"
                    ><?php echo s($saved_models); ?></textarea>
                </div>

                <div class="form-group">
                    <label>Default Model</label>
                    <select id="cfg-default-model" 
                            class="form-control" 
                            data-saved='<?php echo json_encode($saved_default); ?>'>
                        <option value="">-- select after entering models above --</option>
                    </select>
                </div>


                <div class="form-group">
                    <label>System Prompt</label>
                    <textarea id="cfg-sysprompt" class="form-control" rows="10"
                    ><?php echo s($saved_prompt); ?></textarea>
                </div>

                <button id="btn-save-settings" class="app-styled app-styled--success">Save Settings</button>
            </div>
        </div>
        <?php endif; ?>

    </div>
</div>

<script>
const FEEDBACK_DATA = <?php echo $json_data; ?>;
const SAVE_SETTINGS_URL = '<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/save_settings.php';
const GENERATE_URL      = '<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/generate_report.php';
const SESSKEY           = '<?php echo sesskey(); ?>';
const SAVE_REPORT_URL = '<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/save_report.php';
const GET_REPORT_URL  = '<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/get_report.php';
const FEEDBACK_ID     = <?php echo (int)$feedbackid; ?>;
</script>

<script>
// RequireJS to ignore these
//  they are NOT AMD modules
var define_backup = window.define;

window.define = undefined;
</script>


<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/katex.min.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/highlight.min.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/mermaid.min.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/atoast.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/mrnd.js"></script>
<script src="<?php echo $CFG->wwwroot; ?>/local/feedbackexplorer/assets/js/explorer.js"></script>

<script>
// Restore RequireJS 
// define after our scripts are loaded
window.define = define_backup;
</script>



<?php echo $OUTPUT->footer(); ?>