var scApp = angular.module('scApp', []);
scApp.authToken="9937630faad90c62a898a39f78112d59";

scApp.directive('keydown', function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            scope.$apply(function (){
                scope.$eval(attrs.ngEnter);
            });
        });
    };
});

scApp.directive('keyup', function () {
    return function (scope, element, attrs) {
        element.bind("keyup", function (event) {
            scope.$apply(function (){
                scope.$eval(attrs.ngEnter);
            });
        });
    };
});


scApp.factory('utilService', ['$interval', '$http',function($interval, $http) {
    var util= {
        numberPad:function pad(n, width, z) {
            z = z || '0';
            n = n + '';
            width=width || 2;
            return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
        },
        convertToPlaytime:function(position){
          position = (isNaN(position) ? 0 : position);
          var ms = position % 1000;
          position = (position - ms) / 1000;
          var secs = position % 60;
          position = (position - secs) / 60;
          var mins = position % 60;
          var hrs = (position - mins) / 60;
          return (hrs ? util.numberPad(hrs) + '.':'') + util.numberPad(mins) + '.' + util.numberPad(secs);
        },
        timeDiff:function(start, end){
            start=start || 0;
            var diff=end-start;
            var isNeg = (diff < 0) ? true :false;
            isNeg && (diff*=-1);
            return (isNeg ? '-' : '+') + util.convertToPlaytime(diff);
        },
        timeAgo:function(datetime){
            return jQuery.timeago(new Date(datetime));
        },
        getArtwork:function(q, callback){        
            $http.jsonp('https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q='+q+'&tbs=isz:m&callback=JSON_CALLBACK')
                .then(function (result) {
                    result.data.responseData.results.length>0 ? callback(result.data.responseData.results[0].tbUrl) : callback('');
                   // result.data.responseData.results.length>1 ? callback(result.data.responseData.results[1].url) : callback('');
            });
        }
    }    
    return util;
    
}])




  
  



scApp.controller('trackController', ['$scope',
    function($scope) {                
        $scope.$watch('track.stream.position', function(newPosition) {     
            // the track position sliderBar should only respond to changes to the position of the first track in the set...this is because multiple may be playing at once (mixing)
             if(!newPosition||newPosition==undefined){return false;}
             $scope.$index==0 && newPosition && $('#track-progress-sliderBar').setsliderBar(newPosition);
        });          
        $scope.shiftPosition=function(to, from){
            from=from||$scope.$index;
            if(from== to){return false;}   
            $scope.set.shiftPosition(from, to);            
        }
    }
]);

scApp.factory('playerService', function() {
    var player={
        fadeIn:3000,
        fadeOut:10000,
        volume:100,
        shuffle:false
    }
    return player;
});

scApp.factory('setService', ['$interval', '$http', 'playerService', 'notificationService', function($interval, $http, playerService, notificationService) {
    var set={    
        add:function(item){                 
            if(item.kind=='playlist'){
                angular.forEach(item.tracks, function(subitem){
                    set.list.push({meta:subitem});                     
                    set.buildTrack();
                });
                notificationService.show(item.tracks.length + ' tracks from '+ item.title + ' added');
            }else{
                set.list.push({meta:item}); 
                set.buildTrack();
                notificationService.show(item.title + ' by  '+ item.user.username + ' added');
            }             
        },
        buildTrack:function(){        
            var track=set.list[set.list.length-1]; 
            track.stream={};
            track.state={
                playing:false
            };
            track.helper={
                liveStream:null,
                livePolling:{
                    interval:null,
                    iteration:0,
                    start:function(){                    
                       track.state.playing=true;
                       track.helper.livePolling.interval=$interval(track.helper.liveUpdate, 250);                
                    },
                    stop:function(){
                       track.state.playing=false;
                       $interval.cancel(track.helper.livePolling.interval);
                       track.helper.livePolling.iteration=0;
                    }
                },
                liveUpdate: function() {    
                    if(track.helper.liveStream){                         
                        track.stream=track.helper.liveStream;               
                        // mixing for the current track
                        // is track has begun playing and play time is within the fade in period                        
                        if(playerService.fadeIn>0 && track.helper.liveStream.position<playerService.fadeIn){              
                            var percentage=Math.round(playerService.volume*track.helper.liveStream.position/playerService.fadeIn,0);
                            track.helper.liveStream.setVolume(percentage);                    
                         // is track has begun playing and play time is within the fade out period
                        }else if(playerService.fadeOut> 0 && playerService.fadeOut>(track.meta.duration-track.helper.liveStream.position)){
                            var percentage=Math.round(playerService.volume*((track.meta.duration-track.helper.liveStream.position)/playerService.fadeOut),0);
                            track.helper.liveStream.setVolume(percentage);
                         // is track has begun playing and play time is outside of fading periods, max the volume
                        }else if(track.helper.liveStream.volume!=playerService.volume){
                            track.helper.liveStream.setVolume(playerService.volume);
                        }     
                        // current track is playing, fade out amount is more than currently available playtime..so play the next track                          
                        if(set.indexOf(track)==0 && playerService.fadeOut>0 && (track.meta.duration-track.helper.liveStream.position)<playerService.fadeOut){       
                            // if shuffle is on, shuffle the playlist first...
                            if(playerService.shuffle){
                                set.shuffle();
                            }
                            // move currently playing track from playing to end of set
                            set.shiftPosition(0, set.list.length-1);
                        }   
                        track.helper.livePolling.iteration++;
                        (track.helper.liveStream.position>=track.helper.liveStream.duration) && track.helper.livePolling.stop();
                    }
                }
            }            
        },
        remove:function(index){
            set.list.splice(index, 1);
        },
        clear:function(){
            set.list=[];
        },
        indexOf: function(trackObj){
            return ($.inArray(trackObj, set.list) > -1) ? $.inArray(trackObj, set.list)  : false;
        },
        shuffle:function(){
                function shuffle(array) {
                    var counter = array.length, temp, index;
                    // While there are elements in the array
                    while (counter > 0) {
                        // Pick a random index
                        index = Math.floor(Math.random() * counter);
                        // Decrease counter by 1
                        counter--;
                        // And swap the last element with it
                        temp = array[counter];
                        array[counter] = array[index];
                        array[index] = temp;
                    }
                    return array;
                }    
                set.list=shuffle(set.list);
        },
        shiftPosition:function(from, to){
            if(from==0){
                // if the first (playing) item is being moved...shift the entire array by one
                set.list=set.list.concat(set.list.splice(0,1));
            }else if(to==0){
                // if the first (playing) item is being replaced...shift the entire array by the index of the song being moved
                set.list=set.list.concat(set.list.splice(0,from));
            }else{
            // otherwise an item is being moved...keep the array in place but reorganize it  
                set.list.splice(to, 0, set.list.splice(from, 1)[0]);
            }                             
            // if the from position is zero, mix as the next track is simply shifting as part of the natural order
            var isolate = (from==0) ? false : true;
            // if a track is being moved from playing or to playing..play it..
            (from==0 || to==0) && set.togglePlay(0, isolate);                  
        },
        list:[],
        getStream:function(index, callback){
            var trackObj=set.list[index];            
            SC.initialize({
              client_id: scApp.authToken
            });
            SC.stream('/tracks/'+trackObj.meta.id, 
            // soundmanager2 object options                
                { 
                  volume:0,
                  whileplaying: function() {
                         trackObj.helper.liveStream=this;
                   }                  
                }, 
             // callback on stream load
                function(stream){
                    trackObj.stream=stream;
                    callback(true);
              }); 
        },
        stopPlay:function(exclusions){
            (typeof exclusions !== 'object') && (exclusions=exclusions.toString());
            $.each(set.list, function(trackIndex, track){    
                if(exclusions.indexOf(trackIndex)===-1 && track.state.playing){
                    set.togglePlay(trackIndex);
                    track.stream.setPosition(0);
                }
            });        
        },
        togglePlay:function(index, isolate){
            // if we want to isolate this track, pause all others and reset their position to zero
            isolate &&  set.stopPlay(index);            
            var trackObj=set.list[index];
            // set the progress sliderBar to show the track duration correctly
            !trackObj.state.playing && $('#track-progress-sliderBar').sliderBar({
                 start:set.list[0].stream.position || 0,
                 max:trackObj.meta.duration-playerService.fadeOut,
                 onSlide: function(val){
                    // stop all playing tracks except for the current one after changing its position to prevent fade overlaps from quickly changing multiple tracks
                    set.list[0].stream.setPosition && set.list[0].stream.setPosition(val);
                    set.stopPlay(0) ;
                }
            });          
             // if stream loaded and ready, pause or play
            if(trackObj.stream.togglePause){
                trackObj.stream.togglePause();
                if(trackObj.stream.paused){
                    trackObj.helper.livePolling.stop();
                    index==0 && notificationService.show('Playback Paused')
                }else{
                    trackObj.helper.livePolling.start();                
                    index==0 && notificationService.show('Now playing '+trackObj.meta.title + ' by  '+ trackObj.meta.user.username)
                }
            // if stream not loaded, load and play
            }else{            
                set.getStream(index, function(response){
                        set.togglePlay(index);
                });       
            }        
        }
    }
    return set; 
}]);

scApp.controller('setController', ['$scope', 'setService','utilService','playerService',
    function($scope, setService, utilService,playerService) {        
        $scope.set=setService;
        $scope.util=utilService;
        $scope.player=playerService;
        $scope.playTime=function(){
            var playTime=0;
            angular.forEach(setService.list, function(track){
                playTime+=track.meta.duration;
            });
            return playTime;
        }
        $scope.clearSet=function(){
            setService.clear();
        }
        $scope.$watch(function () {
           return $("#track-artwork img").attr('src');
        }, function(val) {
            val && $("#track-artwork img").reflect();
        });
        $scope.$watch('set.list[0].state.playing', function (playing) {        
            playing ? $('#track-progress-sliderBar').addClass('active') : $('#track-progress-sliderBar').removeClass('active');
        });
    }
]);


scApp.factory('notificationService', ['$interval', function($interval) {
    var notifications={
        list:[],
        remove:function(index){
            notifications.list.splice(index, 1);
        },
        show:function(title, body){
            notifications.list.unshift({title:title, body:body, timestamp:new Date().getTime()});
            !notifications.livePolling.running && notifications.livePolling.start();
        },
        cleanUp:function(){
           if($('#notifications li[data-notification-timestamp]:visible').length==0){
               $('#notifications li[data-notification-timestamp]').remove();
               notifications.list=[];
               notifications.livePolling.stop();
            }
        },
        hide:function(el){
            el.slideUp();
        },
        livePolling:{
            liveUpdate:function(){
               var timeNow=new Date().getTime();
               $('#notifications li[data-notification-timestamp]:visible').each(function(index, notification){
                    var timeDiff= timeNow-$(notification).attr('data-notification-timestamp');
                    if(timeDiff>3000){
                        notifications.hide($(notification));
                    }
                });
                notifications.cleanUp();
            },
            interval:null,
            running:false,
            start:function(){
                notifications.livePolling.interval=$interval(notifications.livePolling.liveUpdate, 1000);
                notifications.livePolling.running=true;
             },
            stop:function(){
                $interval.cancel(notifications.livePolling.interval);
                notifications.livePolling.running=false;
            }
         }
    }
    return notifications;
}]);

scApp.controller('pageController', ['$scope', 'searchService', 'playerService','notificationService','$timeout','setService',
    function($scope, searchService, playerService, notificationService, $timeout, setService) {    
        $scope.search=searchService;        
        $scope.player=playerService;
        $scope.set=setService;
        $scope.notifications=notificationService;
        $scope.ctrlPressed=false;
        $scope.keydown=function(event){       
           if(event.keyCode==27 || event.key=="Esc"){
                // escape
                searchService.show = !searchService.show;
                $('#search-input').focus();
           }else if(event.keyCode==32 || event.key=="Spacebar"){
                // space
                if($('input:focus, textarea:focus').length == 0){
                    event.preventDefault();
                    setService.list[0] && setService.togglePlay(0, true);
                 }
           }else if(event.keyCode==17 || event.key=="Control"){
                // ctrl
                $scope.ctrlPressed=true;
           }else if(event.keyCode==13 || event.key=="Enter"){
                // enter
                // console.log(8);
           }
        }
        $scope.keyup=function(event){       
           if(event.keyCode==17 || event.key=="Control"){
                // ctrl
                $scope.ctrlPressed=false;
           }
        }        
        $scope.dismissNotification=function(event){
            notificationService.hide($(event.currentTarget));
        }
       $scope.toggle=function(option){
            if(option=='shuffle'){
                playerService.shuffle=!playerService.shuffle;
                $scope.notifications.show('Shuffle ' + (playerService.shuffle ? 'Enabled':'Disabled'));
           }else{
                var slider=$('#sliderBar'+option);
                var val=slider.getsliderBar();
                var max = slider.attr('data-sliderBar-max');
                val!=max ? slider.setsliderBar(max, true) : slider.setsliderBar(0, true);
           }
       }
       
    angular.element(document).ready(function () {    
        $('.autogrow').autoGrow();
        $('#sliderBarFadeIn').sliderBar({max:15000, start:playerService.fadeIn, vertical:true,
            onSet:function(val){
                $timeout(function() {
                    $scope.notifications.show('Fade in set to '+$('#sliderBarFadeIn').getsliderBar()/1000+'s');
                });                
            },
            onChange:function(val){
                $scope.player.fadeIn=val;
            }
        });
        $('#sliderBarFadeOut').sliderBar({max:15000, start:playerService.fadeOut, vertical:true,
            onSet:function(val){
                $timeout(function() {
                    $scope.notifications.show('Fade out set to '+$('#sliderBarFadeOut').getsliderBar()/1000+'s');
                });                   
            },        
            onChange:function(val){
                $scope.player.fadeOut=val;
            }   
        });
        $('#sliderBarVolume').sliderBar({vertical:true,start:100,
             onSet:function(val){
                $timeout(function() {
                    $scope.notifications.show('Volume set to '+$('#sliderBarVolume').getsliderBar());
                });                   
            },  
            onChange:function(val){
                var icon=$('#sliderBarVolume').parents('li').children('i');
                if(val>0 && val <35){
                    icon.removeClass('fa-volume-up fa-volume-off').addClass('fa-volume-down');
                } else if(val==0){
                    icon.removeClass('fa-volume-down fa-volume-up').addClass('fa-volume-off');            
                }else{
                    icon.removeClass('fa-volume-down fa-volume-off ').addClass('fa-volume-up');
                }
                $scope.player.volume=val;
            }
        });
    });       
       
    }
]);

scApp.factory('searchService', ['$http', function($http) {
    var doRequest = function(query, type) {
      return $http({
        method: 'JSONP',
        url: 'http://api.soundcloud.com/'+type+'.json?q='+query+'&client_id='+scApp.authToken+'&callback=JSON_CALLBACK'
      });
    }
    var search= {
        show:false,
        view:'tracks',
        toggle:function(bool){
            search.show = bool || !search.show;
        },
        query:null,
        polling:{
            users:false,
            tracks:false,
            playlists:false        
        },
        results:{
            users:[],
            tracks:[],
            playlists:[]
        },
        fetch:function(query, type) { 
            return doRequest(query, type); 
        },
        reset:function(){
            search.polling={
                users:false,
                tracks:false,
                playlists:false        
            };
            search.results={
                users:[],
                tracks:[],
                playlists:[]
            };
        }
    }    
    return search;    
}]);


scApp.controller('searchEnactController', ['$scope', 'searchService',
    function($scope, searchService) {   
        $scope.search=searchService;    
    }
]);    
scApp.controller('searchResultController', ['$scope', '$timeout', 'utilService', 'searchService','setService',
    function($scope, $timeout, utilService, searchService, setService) {    
        var timeout;  
        $scope.search=searchService;  
        $scope.set=setService;  
        $scope.add=function(item, append){
            setService.add(item);
            if(!append){
                setService.shiftPosition(setService.list.length-1, 0);
            };
        }
        $scope.util=utilService;  
        $scope.toggle=function(event){        
            utilService.toggle($(event.target));  
        }
       $scope.toggleDetail=function(event){
            var el=$(event.target).parent('.search-result');
            $('.search-result.expand').not(el).removeClass('expand');
            el.toggleClass('expand');        
       }
        function setArtwork(item){
            if(item.artwork_url){
                 item.artwork_url = item.artwork_url.replace('large', 't300x300');                                       
            }else{                                
                item.artwork_url='images/track_artwork_placeholder_2.png';
            //    utilService.getArtwork(item.title+' '+item.tag_list, function(response){
            //        item.artwork_url=response;
            //    });
            }
            return item;            
        }
        $scope.view=function(view){
            $scope.search.view=view;
        }
        $scope.$watch('search.query', function(newQuery) {             
            if (newQuery) {
                if (timeout) $timeout.cancel(timeout);
                searchService.reset();
                timeout = $timeout(function() {
                    searchService.polling.users=true;
                    searchService.polling.playlists=true;
                    searchService.polling.tracks=true;
                    /*
                    searchService.fetch(newQuery, 'users').success(function(data, status, headers) {
                        $scope.search.results.users=data;
                        searchService.polling.users=false;
                    }).error(function(data, status) {searchService.polling.users=false;});
                    */
                    searchService.fetch(newQuery, 'playlists').success(function(data, status, headers) {
                        var result=[];
                        angular.forEach(data, function(playlist){
                            var subResult=[];
                            // loop through each returned playlist
                            angular.forEach(playlist.tracks, function(track){
                                // if the track is streamable, keep it...and add an image if it doesnt have one
                                if(track.streamable){
                                    track=setArtwork(track);
                                    subResult.push(track);
                                }
                            });                            
                            // if the playlist has any streamable tracks, overwrite its tracks property with only these, and add to the available results and add an image if the playlist doesnt have one
                            if(subResult.length>0){
                                playlist.tracks=subResult;
                                playlist=setArtwork(playlist);                               
                                result.push(playlist);
                            }
                        });
                        $scope.search.results.playlists=result;  
                        searchService.polling.playlists=false;                        
                    }).error(function(data, status) {searchService.polling.playlists=false;});
                    searchService.fetch(newQuery, 'tracks').success(function(data, status, headers) {
                        var result=[];
                         // loop through each returned track
                        angular.forEach(data, function(track){
                            // if the track is streamable, keep it...and add an image if it doesnt have one
                            if(track.streamable){
                                track=setArtwork(track);
                                result.push(track);
                            }
                        });
                        $scope.search.results.tracks=result;  
                        searchService.polling.tracks=false;                        
                    }).error(function(data, status) {searchService.polling.tracks=false;});                    
                }, 350);
            }        
        });  
    }
]);