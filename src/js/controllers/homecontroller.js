import _ from 'lodash';
import SettingsDialog from '../../templates/settingsdialog.html';

function mockStreamFromChannel(channel) {
  const videoBanner = channel.video_banner || '/assets/defaultChannelBanner-1920x1080.png';
  return {
    preview: {
      small: videoBanner.replace('1920x1080', '240x135'),
      medium: videoBanner.replace('1920x1080', '480x270'),
      large: videoBanner
    },
    channel
  };
}

export default class HomeController {
  constructor($scope, $timeout, ApiService, $mdDialog) {
    'ngInject';

    this.$timeout = $timeout;
    this.layout = $scope.layout;
    this.container = $scope.container;
    this.state = $scope.state;
    this.ApiService = ApiService;
    this.mainCtrl = $scope.$parent.mainCtrl;
    this.$mdDialog = $mdDialog;

    this.streamSearchText = '';
    this.globalStreams = [];
    this.followedStreams = [];
    this.searchedStreams = null;
    this.selectedStreamsTab = 0;

    this.searchForStreamsThrottled = _.throttle(searchText => this.searchForStreams(searchText), 500);
    this.currentStreamSearch = null;

    this.getGlobalStreams();
    $timeout(() => {
      if (this.mainCtrl.auth) this.selectedStreamsTab = 1;
      this.getFollowedStreams();
    });

    this.currentChannel = 'cbenni';
  }

  async getGlobalStreams() {
    try {
      const streamsResponse = await this.ApiService.twitchGet('https://api.twitch.tv/kraken/streams/');
      if (streamsResponse.data.streams) {
        this.globalStreams = streamsResponse.data.streams;
      }
    } catch (err) {
      console.error(err);
    }

    this.$timeout(() => {
      this.getGlobalStreams();
    }, 60 * 1000);
  }

  async getFollowedStreams() {
    if (this.mainCtrl.auth) {
      try {
        const streamsResponse = await this.ApiService.twitchGet('https://api.twitch.tv/kraken/streams/followed/', null, this.mainCtrl.auth.token);
        if (streamsResponse.data.streams) {
          this.followedStreams = streamsResponse.data.streams;
        }
      } catch (err) {
        console.error(err);
      }

      this.$timeout(() => {
        this.getFollowedStreams();
      }, 60 * 1000);
    }
  }

  async getSearchedStreams() {
    const searchText = this.streamSearchText;
    this.searchForStreamsThrottled(searchText);
  }

  getStreams() {
    if (this.searchedStreams !== null) return this.searchedStreams;
    if (this.followedStreams.length > 0) return this.followedStreams;
    return this.globalStreams;
  }

  searchForStreams(searchText) {
    try {
      if (searchText.length > 0) {
        console.log(`Starting search for ${searchText}`);
        const streamsSearch = this.ApiService.twitchGet(`https://api.twitch.tv/kraken/search/streams?query=${window.encodeURIComponent(searchText)}&limit=25`)
        .then(response => response.data.streams);
        const channelLookup = this.ApiService.twitchGetUserByName(searchText).then(user => {
          if (user) return this.ApiService.twitchGet(`https://api.twitch.tv/kraken/channels/${user._id}`).then(response => [mockStreamFromChannel(response.data)]);
          return [];
        });
        const channelSearch = this.ApiService.twitchGet(`https://api.twitch.tv/kraken/search/channels?query=${window.encodeURIComponent(searchText)}&limit=25`)
        .then(response => {
          const channels = response.data.channels;
          return _.map(channels, mockStreamFromChannel);
        });
        return Promise.all([channelLookup, streamsSearch, channelSearch]).then(results => {
          console.log(`Search results for ${searchText}: `, results);
          this.searchedStreams = _.uniqBy(_.flatten(results), a => `${a.channel._id}`);
          this.selectedStreamsTab = 2;
        });
      }
      this.searchedStreams = null;
    } catch (err) {
      console.error(err);
    }
    return null;
  }

  debugTest(...args) {
    console.log('Debug test: ', args);
  }

  openSettings($event) {
    this.$mdDialog.show({
      template: SettingsDialog,
      targetEvent: $event,
      clickOutsideToClose: true,
      escapeToClose: true,
      controller: 'SettingsDialogController',
      controllerAs: 'dialogCtrl',
      locals: {
        mainCtrl: this.mainCtrl,
        homeCtrl: this
      },
      bindToController: true
    }).finally(() => {
      this.mainCtrl.updateConfig();
    });
  }
}
