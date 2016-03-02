import React, { Component } from 'react';
import $ from 'jquery';


import SongCard from './song_card';
import SearchBar from './searchBar';
import PlayerBar from './playerBar';
import SongsTable from './songsTable';


import deleteButton from '../img/delete.png';




export default class Player extends Component {

	constructor(props){
		super(props);
	}

	handleSongLinkClicks = (e) => {
		e.preventDefault();
		let song = e.target.getAttribute("data");
		let url = `${this.props.baseUrl}play/${song}/next/`;
		console.log(url);
		$.get(url, (data) => {
			console.log(data);
			this.props.updateTitle(data.nowPlaying);
			this.props.updateQueue(data.queue);
		});
	}

	handleQueueLinkClicks = (e) => {
		e.preventDefault();
		let song = e.target.getAttribute("data");
		let url = `${this.props.baseUrl}play/`;
		$.get(`${this.props.baseUrl}play/${song}`, (data) => {
			this.props.updateTitle(data.nowPlaying);
		});
	}

	deleteFromQueue = (index) => {
		let url = `${this.props.baseUrl}queue/remove/${index}`;
		$.get(url, (data) => {
			this.props.updateQueue(data.queue);
		});
	}

	handleDeleteClick = (e) => {
		e.preventDefault();
		console.log(e.target.getAttribute("data"));
		this.deleteFromQueue(e.target.getAttribute("data"));
	}

	render() {
		return (
			<div>
				<div className="row">
					<div className="large-12 columns">
						<h4>Recherche: </h4>
						<SearchBar baseUrl={this.props.baseUrl}
						updateTitle={this.props.updateTitle}
						updateQueue={this.props.updateQueue}
						songs={this.props.songs}/>
					</div>
				</div>
				<div className="row">
					<SongsTable
						title="Morceaux"
						size="6"
						songs={this.props.songs}
						handleSongLinkClicks={this.handleSongLinkClicks}/>

					<SongsTable
						title="File"
						size="6"
						songs={this.props.queue}
						handleSongLinkClicks={this.handleQueueLinkClicks}
						buttonPic={deleteButton}
						handleButtonClick={this.handleDeleteClick}/>

					<PlayerBar
						baseUrl={this.props.baseUrl}
						title={this.props.title} 
						updateTitle={this.props.updateTitle}
						updateQueue={this.props.updateQueue}/>
				</div>
			</div>
			)
	}
}