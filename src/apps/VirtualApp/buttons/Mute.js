import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Mic, MicOff } from '@material-ui/icons';
import ButtonBase from '@material-ui/core/ButtonBase';
import red from '@material-ui/core/colors/red';

const useStyles = makeStyles({
  label: {
    width: '100%',
    display: 'block',
    marginTop: '2px',
    whiteSpace: 'nowrap'
  },
  disabled: {
    opacity: 0.5
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    margin: '0.5em 1em'
  }
});

const Mute = (props) => {
  const { action, isOn, disabled, t } = props;

  const classes = useStyles();

  const handleAction = () => action(isOn);
  return (
    <ButtonBase
      variant="contained"
      color="secondary"
      disabled={disabled}
      onClick={() => handleAction()}
      classes={{
        root: classes.button,
        disabled: classes.disabled
      }}
    >

      {
        isOn
          ? <MicOff style={{ color: red[500], fontSize: '1.8rem' }} />
          : <Mic style={{ fontSize: '1.8rem' }} />
      }
      <span className={classes.label}>
        {t(isOn ? 'oldClient.unMute' : 'oldClient.mute')}
      </span>
    </ButtonBase>
  );

};

export { Mute };
export default Mute;