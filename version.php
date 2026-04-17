<?php
// Protect the file from being
//  accessed directly via a web browser.
defined('MOODLE_INTERNAL') || die();

// The name of our plugin
$plugin->component = 'local_feedbackexplorer'; 
// The current date (YYYYMMDD) plus a 2-digit increment
$plugin->version   = 2026041700; 
// Requires Moodle 4.0 or newer              
$plugin->requires  = 2022041900; 
 // We are in the testing phase              
$plugin->maturity  = MATURITY_ALPHA;          
$plugin->release   = 'v0.1';

// Plugin metadata
$plugin->author    = 'Grace Peter Mutiibwa';
$plugin->license   = 'GNU GPL v3 or later';