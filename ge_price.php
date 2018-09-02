<?php
header("Content-Type: application/json");
$obj = json_decode(@file_get_contents("http://services.runescape.com/m=itemdb_rs/api/catalogue/detail.json?item={$_GET["id"]}"));
$price = @$obj->item->current->price;
die(json_encode(array("id"=>$_GET["id"],"price"=>$price)));