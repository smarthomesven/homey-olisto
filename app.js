'use strict';

const Homey = require('homey');
const axios = require('axios');

module.exports = class OlistoApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    try {
      const enableTriggAction = this.homey.flow.getActionCard('enable_trigg');
      enableTriggAction.registerRunListener(async (args, state) => {
        const result = await this.setTrigg(true, args.trigg.id);
        return result;
      });
      const disableTriggAction = this.homey.flow.getActionCard('disable_trigg');
      disableTriggAction.registerRunListener(async (args, state) => {
        const result = await this.setTrigg(false, args.trigg.id);
        return result;
      });
      const pressNowButtonAction = this.homey.flow.getActionCard('press_now_button');
      pressNowButtonAction.registerRunListener(async (args, state) => {
        const result = await this.pressNowButton(args.button.id);
        return result;
      });
      enableTriggAction.registerArgumentAutocompleteListener(
      "trigg", async (query, args) => this.getTriggs(query));
      disableTriggAction.registerArgumentAutocompleteListener(
      "trigg", async (query, args) => this.getTriggs(query));
      pressNowButtonAction.registerArgumentAutocompleteListener(
      "button", async (query, args) => this.getButtons(query));
      this.log('Olisto has been initialized');
    } catch (error) {
      this.log('Error during Olisto initialization: ', error);
    }
  }
  async getTriggs(query) {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get('https://connect.olisto.com/api/v2/triggs?format=6&bundleInstance=null', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const triggs = response.data;
      const results = triggs.map(trigg => {
        let enabled;
        if (trigg.enabled) {
          enabled = "Enabled"
        } else {
          enabled = "Disabled"
        }
        return {
          name: trigg.name,
          id: trigg._id,
          description: `${trigg.category} • ${enabled}`
        };
      });
      return results.filter((result) => {
        return result.name.toLowerCase().includes(query.toLowerCase());
      });
    } catch (error) {
      throw new Error("Failed fetching triggs: " + error.message);
    }
  }
  async getButtons(query) {
    try {
      const token = await this.getAuthToken();
      const channels = await axios.get('https://connect.olisto.com/api/v1/channelaccounts?showUnits=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = channels.data;
      const buttons = data.find(
        c => c.channel === "triggi-buttons" || c.name === "triggi-buttons"
      );
      const units = buttons
      ? buttons.units.filter(u => !u.hideFromChannelDetails)
      : [];
      const results = units.map(u => ({
        id: u._id,
        name: u.name,
      }));
      return results.filter((result) => {
        return result.name.toLowerCase().includes(query.toLowerCase());
      });
    } catch (error) {
      throw new Error("Failed fetching buttons: " + error.message);
    }
  }
  async setTrigg(enable, triggId) {
    try {
      const token = await this.getAuthToken();
      if (!triggId) {
        throw new Error('Trigg ID is not provided');
      }
      const response = await axios.put(`https://connect.olisto.com/api/v2/triggs/${triggId}/enabled`, {
        enabled: enable
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return (response.data.success === true);
    } catch (error) {
      throw new Error("Failed setting trigg: " + error.message);
    }
  }
  async pressNowButton(buttonId) {
    try {
      const token = await this.getAuthToken();
      if (!buttonId) {
        throw new Error('Button ID is not provided');
      }
      const response = await axios.post(`https://connect.olisto.com/channel/triggi-buttons/push/${buttonId}?phone=undefined`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return (response.data.success === true);
    } catch (error) {
      throw new Error("Failed pressing button: " + error.message);
    }
  }
  async appLogin(body) {
    try {
    const email = body.email;
    const password = body.password;
    const result = await this.loginOlisto(email, password);
    return result;
    } catch (error) {
      throw new Error("Login failed: " + error.message);
    }
  }
  async getAuthToken() {
    const token = this.homey.settings.get('token');
    const pendingLogin = this.homey.settings.get('pendingLogin');
    if (pendingLogin) throw new Error('Pending login, please wait.');
    if (!token) throw new Error('Olisto credentials are not set');
    return token;
  }
  async loginOlisto(email,password) {
    try {
      const response = await axios.post('https://connect.olisto.com/api/v2/users/login?response_type=bearer', {
        email: email,
        password: password,
        locale: 'en-US',
        campaignInfo: null
      });
      if (!response.data.success) {
        return false;
      }
      const token = response.data.token;
      if (!token) {
        return false;
      }
      this.homey.settings.set('token', token);
      this.homey.settings.set('pendingLogin', false);
      this.log('Olisto login successful');
      return true;
    } catch (error) {
      this.homey.settings.set('pendingLogin', false);
      return false;
    }
  }

};
