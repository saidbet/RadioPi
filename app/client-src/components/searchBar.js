import React, { Component } from 'react';
import $ from 'jquery';

export default class SearchBar extends Component {
	constructor(props){
		super(props);

		this.state = {
			search: ''
		}
	}

	handleChange = (e) => {
		this.setState({
			search: e.target.value
		})
	}

	playSong = (e) => {
		e.preventDefault();
		$.get(this.props.baseUrl + 'play/' + this.state.search, (data) => {
			this.props.updateTitle(data.nowPlaying);
			this.setState({
				search: ''
			});
		});
	}

	render(){
		return (
			<form onSubmit={this.playSong}>
				<input value={this.state.search} onChange={this.handleChange} type="text" placeholder="Entrer un nom d'artiste ou le nom d'une chanson"className="large-12 columns" />
			</form>
			)
	}
}